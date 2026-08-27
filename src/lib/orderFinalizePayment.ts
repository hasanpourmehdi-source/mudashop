import { randomUUID } from "crypto";
import type { Order, OrderItem, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyWalletTransaction, getOrCreateWallet } from "@/lib/wallet";
import { NO_COST_SHIPPING_METHODS } from "@/lib/shipping";
import { computePaymentDeadline } from "@/lib/orderPaymentDeadline";
import { getSiteSetting, getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { applyReferralRewardIfEligible } from "@/lib/referral";

export type FinalizeResult =
  | { ok: true; order: Order; finalTotal: number }
  | { ok: false; error: string; status: number };

// نهایی‌سازیِ دورِ اولِ پرداخت (هزینه‌ی ارسالِ سفارشِ مزون + تخصیصِ کارت) --
// هم از routeِ دستیِ ادمین (finalize-shipping) صدا زده می‌شه، هم از خودِ
// routeِ ثبتِ سفارش وقتی «تأییدِ اولیه‌ی ادمین» از تنظیمات خاموش باشه (اون‌جا
// bankCardId داده نمی‌شه، پس این تابع خودش دنبالِ کارتِ پیش‌فرض می‌گرده)
export async function finalizeItemsPayment(
  orderId: string,
  opts: { shippingMethod?: string; shippingCost?: number; bankCardId?: string }
): Promise<FinalizeResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false, error: "سفارش یافت نشد", status: 404 };
  if (order.paymentStatus !== "PENDING") {
    return { ok: false, error: "این سفارش در انتظار تعیین هزینه ارسال نیست", status: 400 };
  }
  if (order.itemsNegotiationStatus === "AWAITING_CUSTOMER_REVIEW") {
    return { ok: false, error: "منتظر بررسی و تایید مشتری روی تغییرات اقلام سفارش هستیم", status: 400 };
  }

  const hasExternalItems = order.items.some((i: OrderItem) => i.source === "TRENDYOL");
  const method = order.shippingMethod ?? opts.shippingMethod ?? null;
  const skipShippingCalculation = await getSiteSettingBool(SITE_SETTING_KEYS.SKIP_SHIPPING_CALCULATION);

  let finalShippingCost: number;
  let persistShippingCost: number | null;
  let persistShippingMethod: string | null;

  if (skipShippingCalculation) {
    // قبلاً توی قیمتِ کالا لحاظ شده -- همیشه صفر، صرف‌نظر از روش/آدرس
    finalShippingCost = 0;
    persistShippingCost = 0;
    persistShippingMethod = method;
  } else if (order.freeShippingApplied) {
    finalShippingCost = 0;
    persistShippingCost = 0;
    persistShippingMethod = method;
  } else if (hasExternalItems) {
    finalShippingCost = 0;
    persistShippingCost = null;
    persistShippingMethod = null;
  } else {
    if (!method) return { ok: false, error: "نحوه ارسال مشخص نیست", status: 400 };
    if (NO_COST_SHIPPING_METHODS.includes(method as (typeof NO_COST_SHIPPING_METHODS)[number])) {
      finalShippingCost = 0;
    } else {
      const explicit = opts.shippingCost ?? order.shippingCost ?? undefined;
      if (explicit === undefined) {
        return { ok: false, error: "هزینه ارسال را وارد کنید", status: 400 };
      }
      finalShippingCost = explicit;
    }
    persistShippingCost = finalShippingCost;
    persistShippingMethod = method;
  }

  // اینورینتِ «total همیشه هزینه‌ی ارسالِ فعلی رو داخلش داره» (سفارشِ
  // فقط-مزون؛ برای خارجی shippingCost تهیه): هم لحظه‌ی ثبت سفارش این‌طوره و
  // هم recomputeOrderTotals مواظبه حفظش باشه. پس قبل از اضافه‌کردن ارسالِ
  // جدید، ارسالِ قبلی باید از total کم بشه -- وگرنه دوبار حساب می‌شه
  const totalBeforeWallet =
    order.total - (hasExternalItems ? 0 : order.shippingCost ?? 0) + finalShippingCost;

  let walletUsed = 0;
  if (order.useWalletRequested) {
    const wallet = await getOrCreateWallet(order.userId);
    walletUsed = Math.min(wallet.balance, totalBeforeWallet);
  }
  const finalTotal = totalBeforeWallet - walletUsed;

  // پرداخت‌درمحل: پول موقع تحویل نقدی گرفته می‌شه، پس نه کارتی تخصیص داده
  // می‌شه نه منتظرِ آپلود فیش می‌مونیم -- درست مثلِ finalTotal===0، مستقیم PAID
  const isCashOnDelivery = order.paymentMethod === "CASH_ON_DELIVERY";

  let assignedCard: { cardNumber: string; shebaNumber: string | null; holderName: string } | null = null;
  if (finalTotal > 0 && !isCashOnDelivery) {
    const cardId = opts.bankCardId;
    assignedCard = cardId
      ? await prisma.bankCard.findUnique({ where: { id: cardId } })
      : // ترتیبِ قطعی -- بدونِ orderBy، Prisma ردیفِ دلخواه برمی‌گردونه و
        // هر سفارش ممکنه کارتِ متفاوتی ببینه
        await prisma.bankCard.findFirst({ where: { isActive: true, isDefault: true } }).then(
            (c) =>
              c ??
              prisma.bankCard.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: "asc" },
              })
          );
    if (!assignedCard) {
      return {
        ok: false,
        error: cardId ? "کارت بانکی یافت نشد" : "هیچ کارتِ بانکیِ فعالی برای تخصیصِ خودکار پیدا نشد",
        status: 404,
      };
    }
  }

  // وضعیتِ نهاییِ پرداخت از قبل قابل محاسبه‌ست -- برای گاردِ اتمیِ داخل تراکنش لازمه
  const willBePaid = finalTotal === 0 || isCashOnDelivery;
  const deadlineAt = willBePaid
    ? null
    : computePaymentDeadline(new Date(), Number(await getSiteSetting(SITE_SETTING_KEYS.PAYMENT_DEADLINE_H)) || 48);

  // گاردِ همزمانی: خواندن/چکِ paymentStatus بیرون از تراکنش کافی نیست -- دو
  // فراخوانیِ همپوشان (دابل‌کلیک یا finalize دستیِ ادمین مسابقه با auto-finalize
  // ثبت سفارش) هر دو از گارد رد می‌شدن و کیف پول دوبار کسر می‌شد. آپدیتِ
  // شرطیِ updateMany اتمیه؛ فقط اولین فراخوانی که هنوز PENDING رو می‌بینه
  // برنده می‌شه، بقیه با count=0 کنار گذاشته می‌شن (قبل از هر جابه‌جایی پول)
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: "PENDING" },
      data: {
        shippingCost: persistShippingCost,
        shippingMethod: persistShippingMethod,
        itemsNegotiationStatus: "AGREED",
        walletUsed,
        total: finalTotal,
        ...(willBePaid
          ? { paymentStatus: "PAID", paidAt: new Date() }
          : {
              paymentStatus: "AWAITING_PAYMENT",
              paymentAuthority: `sim_${randomUUID()}`,
              assignedCardNumber: assignedCard!.cardNumber,
              assignedShebaNumber: assignedCard!.shebaNumber,
              assignedCardHolder: assignedCard!.holderName,
              paymentDeadlineAt: deadlineAt,
            }),
      },
    });
    if (claimed.count === 0) return null;

    if (walletUsed > 0) {
      await applyWalletTransaction(tx, {
        userId: order.userId,
        amount: walletUsed,
        type: "PURCHASE",
        description: `پرداخت سفارش #${order.id.slice(-8)}`,
        orderId: order.id,
      });
    }

    const result = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: result.status,
        note:
          finalTotal === 0
            ? "هزینه ارسال صفر تعیین شد و کل مبلغ از کیف پول کسر شد"
            : isCashOnDelivery
            ? "پرداخت‌درمحل انتخاب شده -- بدون تخصیص کارت، موقع تحویل نقدی دریافت می‌شود"
            : "شماره کارت و هزینه ارسال برای پرداخت مشتری ارسال شد",
      },
    });

    if (!willBePaid) {
      await tx.orderPaymentEvent.create({
        data: {
          orderId,
          round: "items",
          purpose: "هزینه اقلام سفارش",
          amount: finalTotal,
          cardNumber: assignedCard!.cardNumber,
          cardHolder: assignedCard!.holderName,
          shebaNumber: assignedCard!.shebaNumber,
        },
      });
    }

    return result;
  });

  if (!updated) {
    return { ok: false, error: "این سفارش قبلاً نهایی شده است", status: 409 };
  }

  if (finalTotal === 0 || isCashOnDelivery) {
    await applyReferralRewardIfEligible(orderId);
  }

  return { ok: true, order: updated, finalTotal };
}

// دورِ دومِ پرداخت (هزینه‌ی باربریِ سفارشِ خارجی) وقتی «محاسبه‌ی هزینه ارسال/
// باربری» از تنظیمات خاموشه -- به‌محضِ این‌که همه‌ی اقلامِ خارجی به یه نتیجه‌ی
// نهایی رسیدن (allArrived)، به‌جای منتظرِ ادمین موندن برای set-shipping-cost،
// خودکار cargoCost=0 ثبت می‌شه و ShippingPayment مستقیم PAID می‌شه -- همون
// گاردِ SHIPPED (که نیاز به وجودِ یه ShippingPaymentِ PAID داره) دست‌نخورده
// می‌مونه، فقط مقدارش خودکار صفر پر می‌شه. اختلافِ قیمتِ خریدِ واقعی (اگه
// بود) مستقل از این توگل همچنان با کیف‌پول تسویه می‌شه -- این یه تسویه‌ی
// مالیِ جداست، نه بخشی از «محاسبه‌ی هزینه‌ی ارسال»
export async function autoSettleShippingCostIfEnabled(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<boolean> {
  if (!(await getSiteSettingBool(SITE_SETTING_KEYS.SKIP_SHIPPING_CALCULATION))) return false;

  const order = await tx.order.findUnique({ where: { id: orderId }, include: { shippingPayment: true, items: true } });
  if (!order || order.paymentStatus !== "PAID") return false;
  // فقط وقتی هنوز هیچ ردیفی وجود نداره تسویه انجام می‌شه. ردیفِ FAILED (مثلاً
  // پس از برگشت‌به‌فرستنده) عمداً این‌جا نادیده گرفته می‌شه -- این تابع
  // previousWalletOffset رو جبران نمی‌کنه و اجرایِ دوباره‌ش اختلاف قیمت رو
  // دوباره به کیف پول برمی‌گردوند (پول رایگان)؛ مسیرِ تلاش مجدد همون route
  // دستیِ set-shipping-cost هست که جبران رو درست انجام می‌ده
  if (order.shippingPayment) return false;

  const priceAdjustment = order.items
    .filter(
      (i) =>
        i.source === "TRENDYOL" &&
        (i.purchaseStatus === "PURCHASED" || i.purchaseStatus === "RECEIVED") &&
        i.purchasePriceActual != null
    )
    .reduce((sum, i) => sum + (i.purchasePriceActual! - i.price) * i.quantity, 0);

  let walletOffset = 0;
  if (priceAdjustment < 0) {
    await applyWalletTransaction(tx, {
      userId: order.userId,
      amount: -priceAdjustment,
      type: "REFUND",
      description: `تسویه اختلاف قیمت خرید اقلام سفارش #${orderId.slice(-8)} -- هزینه ارسال از قبل توی قیمت کالا لحاظ شده`,
      orderId,
    });
  } else if (priceAdjustment > 0) {
    const wallet = await getOrCreateWallet(order.userId, tx);
    walletOffset = Math.min(wallet.balance, priceAdjustment);
    if (walletOffset > 0) {
      await applyWalletTransaction(tx, {
        userId: order.userId,
        amount: walletOffset,
        type: "PURCHASE",
        description: `کسر اختلاف قیمت خرید اقلام سفارش #${orderId.slice(-8)} از کیف پول`,
        orderId,
      });
    }
  }

  await tx.shippingPayment.upsert({
    where: { orderId },
    create: { orderId, amount: 0, shippingCost: 0, cargoCost: 0, walletOffset, status: "PAID", paidAt: new Date() },
    update: {
      amount: 0,
      shippingCost: 0,
      cargoCost: 0,
      walletOffset,
      status: "PAID",
      paidAt: new Date(),
      receiptImage: null,
      receiptSubmittedAt: null,
    },
  });
  await tx.orderStatusHistory.create({
    data: {
      orderId,
      status: order.status,
      note: "هزینه ارسال/باربری از قبل توی قیمت کالا لحاظ شده -- خودکار صفر ثبت شد",
    },
  });

  return true;
}

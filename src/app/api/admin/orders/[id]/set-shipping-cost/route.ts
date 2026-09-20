import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { shippingPaymentStatusLabel } from "@/lib/orderStatusMessages";
import { applyWalletTransaction, getOrCreateWallet } from "@/lib/wallet";
import { SITE_SETTING_KEYS, getSiteSetting } from "@/lib/siteSettings";
import { computePaymentDeadline } from "@/lib/orderPaymentDeadline";
import { computePurchaseSummary } from "@/lib/orderPurchaseStatus";
import { z } from "zod";

const itemBreakdownSchema = z.object({
  itemId: z.string(),
  weightGrams: z.number().int().nonnegative().nullable().optional(),
  cargoCost: z.number().int().nonnegative().nullable().optional(),
});

const schema = z.object({
  shippingCost: z.number().int().nonnegative(),
  cargoCost: z.number().int().nonnegative(),
  // ریز وزن/هزینه‌ی باربری هر قلم -- فقط برای ثبت و نمایش به مشتری (اعتمادسازی)،
  // مبلغ نهایی همچنان از روی cargoCost بالا (که ادمین می‌تونه دستی override کنه) حساب می‌شه
  items: z.array(itemBreakdownSchema).optional(),
  cargoRatePerKg: z.number().int().nonnegative().optional(),
  bankCardId: z.string().optional(),
});

// دور دوم: بعد از این‌که سفارش خارجی (ترندیول) قبلاً برای مبلغ اقلامش PAID شده
// و کالا خریداری/وزن‌کشی شد، ادمین اینجا هزینه‌ی واقعی ارسال رو وارد می‌کنه و
// (اگه مبلغی باقی مونده) یه کارت برای دریافتش تخصیص می‌ده -- دقیقاً همون الگوی
// finalize-shipping ولی روی یه ShippingPayment جدا، نه فیلدهای دور اول Order
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, shippingPayment: true },
  });
  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");
  // برای سفارش مزونیِ عادی (بدون ShippingPayment)، این مسیر معنی نداره -- هزینه
  // ارسالش از قبل توی finalize-shipping (دور اول) تعیین شده. ولی اگه یه
  // ShippingPayment از قبل وجود داره (چون بسته برگشت خورده -- mark-returned-to-sender)،
  // حتی برای مزون هم باید اجازه‌ی تعیین مجدد هزینه ارسال بدیم
  if (!hasExternalItems && !order.shippingPayment) {
    return NextResponse.json({ error: "این سفارش کالای خارجی ندارد" }, { status: 400 });
  }
  if (order.paymentStatus !== "PAID") {
    return NextResponse.json(
      { error: "ابتدا باید پرداخت مبلغ اقلام این سفارش تکمیل شده باشد" },
      { status: 400 }
    );
  }
  // نباید بشه هزینه ارسال (و در ادامه‌ش کل سفارش) رو جلو برد مگه این‌که فاز ۲
  // (رسیدنِ فیزیکی/بررسی) هم برای همه‌ی اقلام خارجی تموم شده باشه -- نه فقط
  // فاز ۱ (خریداری‌شده). صرفاً PURCHASED کافی نیست چون یعنی هنوز فیزیکی به
  // انبار نرسیده/بررسی نشده (ممکنه گم بشه یا مغایرت داشته باشه)؛ allArrived
  // همون تعریفیه که خودِ سیستم (notifyIfAllArrived) برای «آماده‌ی ارسال» داره.
  // بدون این گارد، سفارش می‌تونه بدون تکمیل فاز ۲ تا SHIPPED/DELIVERED بره، و
  // چون canCustomerCancelOrder دقیقاً روی purchaseStatus اقلام تکیه می‌کنه،
  // این باعث می‌شه مشتری بتونه سفارشِ تحویل‌داده‌شده رو هم «درخواست لغو» بزنه
  if (hasExternalItems && !computePurchaseSummary(order.items).allArrived) {
    return NextResponse.json(
      {
        error:
          "ابتدا باید همه‌ی اقلام خارجی این سفارش خریداری/کنسل و (در صورت خرید) نتیجه‌ی نهایی رسیدنشون ثبت شده باشد",
      },
      { status: 400 }
    );
  }
  // اگه قبلاً درخواست هزینه ارسال ثبت شده (چه در انتظار پرداخت/تأیید، چه
  // پرداخت‌شده)، دوباره نباید بشه -- مگر این‌که همون درخواست قبلی رد شده باشه
  // (FAILED)، که یعنی ادمین می‌خواد با هزینه/کارت دیگه‌ای دوباره تلاش کنه
  if (order.shippingPayment && order.shippingPayment.status !== "FAILED") {
    return NextResponse.json(
      { error: "درخواست پرداخت هزینه ارسال قبلاً برای این سفارش ثبت شده است" },
      { status: 400 }
    );
  }

  const { shippingCost, cargoCost, items: itemBreakdown, cargoRatePerKg, bankCardId } = parsed.data;

  // اختلاف قیمت خریدِ واقعیِ اقلام (اگه با قیمتی که مشتری پرداخت کرده فرق
  // داشت) همین‌جا با مشتری تسویه می‌شه -- نه فوری کیف‌پول؛ مثبت یعنی مشتری
  // بیشتر بدهکاره، منفی یعنی بستانکاره
  const priceAdjustment = order.items
    .filter(
      (i) =>
        i.source === "TRENDYOL" &&
        (i.purchaseStatus === "PURCHASED" || i.purchaseStatus === "RECEIVED") &&
        i.purchasePriceActual != null
    )
    .reduce((sum, i) => sum + (i.purchasePriceActual! - i.price) * i.quantity, 0);

  const totalCost = shippingCost + cargoCost + priceAdjustment;

  // اگه مشتری بدهکاره (totalCost مثبت) و از قبل توی کیف پولش موجودی داره
  // (مثلاً بابت رفاند اقلامی که با مغایرت برگشت خورده)، خودکار همون‌قدر از
  // کیف پول کسر می‌شه -- فقط باقی‌مانده (remainder) نیاز به کارت/پرداخت جدید داره.
  // اگه این یه تلاش دوباره‌ست (بعد از رد فیش قبلی)، اول باید طوری حساب کنیم
  // که انگار کسر قبلی هیچ‌وقت اتفاق نیفتاده -- وگرنه با هر تلاش مجدد، دوبار
  // از کیف پول کسر می‌شد
  const wallet = await getOrCreateWallet(order.userId);
  const previousWalletOffset = order.shippingPayment?.walletOffset ?? 0;
  const availableBalance = wallet.balance + previousWalletOffset;
  let walletOffset = 0;
  if (totalCost > 0) {
    walletOffset = Math.min(availableBalance, totalCost);
  }
  const remainder = totalCost - walletOffset;

  // پرداخت‌درمحل: باقی‌مانده هم نقدی موقع تحویل گرفته می‌شه -- نه کارتی لازمه نه
  // منتظرِ فیش می‌مونیم، درست مثلِ اینکه از قبل صفر بوده
  const isCashOnDelivery = order.paymentMethod === "CASH_ON_DELIVERY";

  let assignedCard: { cardNumber: string; shebaNumber: string | null; holderName: string } | null = null;
  if (remainder > 0 && !isCashOnDelivery) {
    if (bankCardId) {
      assignedCard = await prisma.bankCard.findUnique({ where: { id: bankCardId } });
      if (!assignedCard) {
        return NextResponse.json({ error: "کارت بانکی یافت نشد" }, { status: 404 });
      }
    } else {
      // ادمین کارتی انتخاب نکرده -- بر اساسِ ترکیبِ سفارش، خودکار کارتِ
      // پیش‌فرضِ همون هدف (باربریِ کالای خارجی، یا ارسالِ سفارشِ فقط-مزون)
      // انتخاب می‌شه؛ اگه هیچ‌کدوم پیش‌فرض نداشتن، مثلِ دورِ اول فالبک به
      // قدیمی‌ترین کارتِ فعال
      const defaultFlag = hasExternalItems ? "isDefaultForCargo" : "isDefaultForShipping";
      assignedCard =
        (await prisma.bankCard.findFirst({ where: { isActive: true, [defaultFlag]: true } })) ??
        (await prisma.bankCard.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
      if (!assignedCard) {
        return NextResponse.json(
          { error: "چون مبلغی باید دریافت شود، یک کارت بانکی انتخاب کنید (هیچ کارتِ فعالی هم ثبت نشده)" },
          { status: 400 }
        );
      }
    }
  }

  const paidNow = remainder <= 0 || isCashOnDelivery;
  // اگه اختلاف قیمت خرید باعث شد مشتری کلاً بستانکار باشه (totalCost منفی)،
  // نیازی به کارت نیست -- مستقیم به کیف‌پول برمی‌گرده (این جدا از walletOffset
  // بالاست -- اون کسر از موجودیِ از قبل موجود بود، این‌جا برعکس، اضافه‌کردنه)
  const refundToWallet = totalCost < 0 ? -totalCost : 0;
  // اگه این تلاش دوباره‌ست (بعد از رد فیش قبلی)، هزینه‌ی دور قبل از قبل توی
  // total لحاظ شده -- باید اول کنار گذاشته بشه، بعد هزینه‌ی جدید اضافه بشه؛
  // وگرنه با هر رد/تلاش‌مجدد، مبلغ دو یا چند بار جمع می‌شد
  const previousShippingTotal = (order.shippingCost ?? 0) + (order.cargoCost ?? 0);

  if (cargoRatePerKg != null) {
    await prisma.siteSetting.upsert({
      where: { key: SITE_SETTING_KEYS.CARGO_RATE_PER_KG },
      create: { key: SITE_SETTING_KEYS.CARGO_RATE_PER_KG, value: String(cargoRatePerKg) },
      update: { value: String(cargoRatePerKg) },
    });
  }

  await prisma.$transaction(async (tx) => {
    // گاردِ همزمانی: wallet و shippingPayment را داخل تراکنش دوباره بخوان --
    // دو درخواستِ همزمان هر دو بیرونِ تراکنش یک balance یکسان دیده بودند
    const freshWallet = await getOrCreateWallet(order.userId, tx);
    const freshAvailable = freshWallet.balance + previousWalletOffset;
    if (totalCost > 0 && freshAvailable < walletOffset) {
      throw new Error("موجودی کیف پول کافی نیست -- لطفاً دوباره تلاش کنید");
    }
    // ریز وزن/هزینه‌ی باربری هر قلم -- فقط برای ثبت و نمایش (اعتماد مشتری)،
    // مبلغ نهایی از cargoCost بالا حساب می‌شه، نه از جمع این‌ها
    for (const entry of itemBreakdown ?? []) {
      if (!order.items.some((i) => i.id === entry.itemId)) continue;
      const computedCost =
        entry.cargoCost ??
        (entry.weightGrams != null ? Math.round((entry.weightGrams * (cargoRatePerKg ?? 0)) / 1000) : undefined);
      await tx.orderItem.update({
        where: { id: entry.itemId },
        data: {
          ...(entry.weightGrams !== undefined ? { itemWeightGrams: entry.weightGrams } : {}),
          ...(computedCost !== undefined ? { itemCargoCost: computedCost } : {}),
        },
      });
    }

    const updatedOrder = await tx.order.update({
      where: { id },
      data: { shippingCost, cargoCost, total: { increment: remainder - previousShippingTotal } },
    });

    if (previousWalletOffset !== walletOffset) {
      if (previousWalletOffset > 0) {
        await applyWalletTransaction(tx, {
          userId: order.userId,
          amount: previousWalletOffset,
          type: "REFUND",
          description: `برگشت کسر قبلیِ هزینه ارسال/باربری سفارش #${id.slice(-8)} (تعیین مجدد)`,
          orderId: order.id,
        });
      }
      if (walletOffset > 0) {
        await applyWalletTransaction(tx, {
          userId: order.userId,
          amount: walletOffset,
          type: "PURCHASE",
          description: `کسر هزینه ارسال/باربری سفارش #${id.slice(-8)} از کیف پول`,
          orderId: order.id,
        });
      }
    }

    if (refundToWallet > 0) {
      await applyWalletTransaction(tx, {
        userId: order.userId,
        amount: refundToWallet,
        type: "REFUND",
        description: `تسویه اختلاف قیمت خرید اقلام سفارش #${id.slice(-8)} به نفع مشتری`,
        orderId: order.id,
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: updatedOrder.status,
        note:
          refundToWallet > 0
            ? `هزینه ارسال/باربری با لحاظ اختلاف قیمت خرید تسویه شد -- ${refundToWallet.toLocaleString("fa-IR")} تومان به کیف پول مشتری بازگشت داده شد`
            : walletOffset > 0 && remainder <= 0
            ? `هزینه ارسال/باربری (${totalCost.toLocaleString("fa-IR")} تومان) کامل از موجودی کیف پول مشتری کسر شد -- نیازی به پرداخت جدید نیست`
            : walletOffset > 0 && isCashOnDelivery
            ? `از هزینه ارسال/باربری (${totalCost.toLocaleString("fa-IR")} تومان)، ${walletOffset.toLocaleString(
                "fa-IR"
              )} تومان از کیف پول مشتری کسر شد و ${remainder.toLocaleString("fa-IR")} تومان باقی‌مانده پرداخت‌درمحل است`
            : walletOffset > 0
            ? `از هزینه ارسال/باربری (${totalCost.toLocaleString("fa-IR")} تومان)، ${walletOffset.toLocaleString(
                "fa-IR"
              )} تومان از کیف پول مشتری کسر شد و ${remainder.toLocaleString("fa-IR")} تومان باقی‌مانده برای پرداخت ارسال شد`
            : isCashOnDelivery && remainder > 0
            ? `هزینه ارسال/باربری (${remainder.toLocaleString("fa-IR")} تومان) پرداخت‌درمحل است -- موقع تحویل نقدی دریافت می‌شود`
            : paidNow
            ? "هزینه ارسال/باربری صفر تعیین شد"
            : "هزینه ارسال و باربری توسط ادمین تعیین و برای پرداخت مشتری ارسال شد",
      },
    });
    const shippingPaymentAmount = Math.max(remainder, 0);
    await tx.shippingPayment.upsert({
      where: { orderId: id },
      create: {
        orderId: id,
        amount: shippingPaymentAmount,
        shippingCost,
        cargoCost,
        walletOffset,
        status: paidNow ? "PAID" : "AWAITING_PAYMENT",
        paidAt: paidNow ? new Date() : null,
        assignedCardNumber: assignedCard?.cardNumber ?? null,
        assignedShebaNumber: assignedCard?.shebaNumber ?? null,
        assignedCardHolder: assignedCard?.holderName ?? null,
      },
      update: {
        amount: shippingPaymentAmount,
        shippingCost,
        cargoCost,
        walletOffset,
        status: paidNow ? "PAID" : "AWAITING_PAYMENT",
        paidAt: paidNow ? new Date() : null,
        assignedCardNumber: assignedCard?.cardNumber ?? null,
        assignedShebaNumber: assignedCard?.shebaNumber ?? null,
        assignedCardHolder: assignedCard?.holderName ?? null,
        receiptImage: null,
        receiptSubmittedAt: null,
      },
    });

    // وقتی هزینه ارسال/باربری اعلام می‌شه و هنوز پرداخت نشده، یه مهلت پرداخت
    // (PAYMENT_DEADLINE_H ساعت) ست می‌شه -- اگه مشتری تا اون موقع واریز نکنه،
    // سفارش (در صورتی که هنوز خریدی انجام نشده باشه) به‌صورت خودکار لغو می‌شه
    if (!paidNow) {
      await tx.order.update({
        where: { id },
        data: {
          paymentDeadlineAt: computePaymentDeadline(
            new Date(),
            Number(await getSiteSetting(SITE_SETTING_KEYS.PAYMENT_DEADLINE_H)) || 48
          ),
        },
      });
    }

    // هر بار که کارتی برای دور دوم تخصیص داده می‌شه (حتی اگه دفعه‌ی قبلی رد
    // شده باشه و الان کارت دیگه‌ای انتخاب شده) یه ردیف جدید ثبت می‌شه، نه
    // آپدیت روی قبلی -- تا تاریخچه‌ی کامل «چه کارتی، چه زمانی» حفظ بشه
    if (assignedCard) {
      await tx.orderPaymentEvent.create({
        data: {
          orderId: id,
          round: "shipping",
          purpose: "هزینه ارسال و باربری",
          amount: totalCost,
          cardNumber: assignedCard.cardNumber,
          cardHolder: assignedCard.holderName,
          shebaNumber: assignedCard.shebaNumber,
        },
      });
    }
  });

  const shortId = id.slice(-8);
  await prisma.notification.create({
    data: {
      userId: order.userId,
      message:
        refundToWallet > 0
          ? `هزینه ارسال/باربری سفارش خارجی #${shortId} با لحاظ اختلاف قیمت خرید تسویه شد -- ${refundToWallet.toLocaleString("fa-IR")} تومان به کیف پول شما بازگشت داده شد.`
          : walletOffset > 0 && remainder <= 0
          ? `هزینه ارسال/باربری سفارش خارجی #${shortId} مبلغ ${totalCost.toLocaleString("fa-IR")} تومان بود که کامل از موجودی کیف پول شما کسر شد -- نیازی به واریز نیست. سفارش شما «${shippingPaymentStatusLabel("PAID")}» قرار گرفت.`
          : walletOffset > 0 && isCashOnDelivery
          ? `هزینه ارسال/باربری سفارش خارجی #${shortId} مبلغ ${totalCost.toLocaleString("fa-IR")} تومان بود؛ ${walletOffset.toLocaleString(
              "fa-IR"
            )} تومان از موجودی کیف پول شما کسر شد و ${remainder.toLocaleString(
              "fa-IR"
            )} تومان باقی‌مانده رو موقع تحویل نقدی پرداخت می‌کنید.`
          : walletOffset > 0
          ? `هزینه ارسال/باربری سفارش خارجی #${shortId} مبلغ ${totalCost.toLocaleString("fa-IR")} تومان بود؛ ${walletOffset.toLocaleString(
              "fa-IR"
            )} تومان از موجودی کیف پول شما کسر شد و ${remainder.toLocaleString(
              "fa-IR"
            )} تومان باقی‌مانده رو باید واریز کنید -- برای پرداخت وارد صفحه‌ی سفارش خود شوید.`
          : isCashOnDelivery && remainder > 0
          ? `هزینه ارسال سفارش خارجی #${shortId} مبلغ ${remainder.toLocaleString("fa-IR")} تومان تعیین شد -- چون پرداخت‌درمحل انتخاب کرده‌اید، موقع تحویل نقدی دریافت می‌شود.`
          : paidNow
          ? `هزینه ارسال سفارش خارجی #${shortId} صفر تعیین شد -- سفارش شما «${shippingPaymentStatusLabel("PAID")}» قرار گرفت.`
          : `هزینه ارسال سفارش خارجی #${shortId} مشخص شد -- سفارش شما «${shippingPaymentStatusLabel("AWAITING_PAYMENT")}»ست، برای پرداخت وارد صفحه‌ی سفارش خود شوید.`,
      link: `/orders/${id}`,
    },
  });

  const updated = await prisma.order.findUnique({ where: { id }, include: { shippingPayment: true } });
  return NextResponse.json(updated);
}

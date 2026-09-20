import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { applyWalletTransaction, getOrCreateWallet } from "@/lib/wallet";
import { SHIPPING_METHODS, NO_COST_SHIPPING_METHODS, calculateShipping, isTehranCity, GIFT_WRAP_COST } from "@/lib/shipping";
import { computePaymentDeadline } from "@/lib/orderPaymentDeadline";
import { SITE_SETTING_KEYS, getSiteSetting } from "@/lib/siteSettings";
import { z } from "zod";

const addressSchema = z.object({
  title: z.string().min(1, "عنوان آدرس الزامی است"),
  fullName: z.string().min(2, "نام گیرنده باید حداقل ۲ حرف باشد"),
  phone: z.string().min(8, "شماره تماس معتبر نیست"),
  province: z.string().min(1, "استان الزامی است"),
  city: z.string().min(1, "شهر الزامی است"),
  postalCode: z.string().min(5, "کد پستی معتبر نیست"),
  detail: z.string().min(3, "آدرس کامل الزامی است"),
});

const schema = z.object({
  newAddress: addressSchema,
  shippingMethod: z.string().optional(),
  bankCardId: z.string().optional(),
  reason: z.string().trim().min(1, "دلیل تغییر آدرس را بنویسید").max(500),
});

// تغییرِ آدرس/نحوه‌ی ارسال به درخواستِ مشتری، بعد از این‌که هزینه‌ی ارسال از قبل
// مشخص/پرداخت شده -- برخلافِ خودِ مشتری (که دیگه دسترسی نداره، چون هزینه‌ی
// قبلی قفل شده)، ادمین می‌تونه این کار رو بکنه چون قراره اختلافِ هزینه رو هم
// دستی تسویه کنه: اگه آدرس/روشِ جدید ارزون‌تره، فوری به کیف‌پول برمی‌گرده؛ اگه
// گرون‌تره، اول از موجودیِ کیف‌پول کسر می‌شه و باقی‌مونده (اگه بود) دقیقاً مثل
// دورِ دومِ هزینه‌ی باربری/ارسالِ سفارش‌های خارجی -- با تخصیصِ کارت و منتظرِ
// آپلود/تأییدِ فیش -- جمع‌آوری می‌شه (همون ShippingPayment، همون فرآیندِ آپلود/
// تأیید و همون گاردِ SHIPPED که از قبل وجود داره)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok, session } = await requireAdmin("ORDERS");
  if (!ok || !session) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, shippingPayment: true },
  });
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  if (!["PENDING", "PROCESSING"].includes(order.status)) {
    return NextResponse.json(
      { error: "این سفارش دیگه قابل تغییر آدرس نیست (ارسال/تحویل/لغو/مرجوع شده)" },
      { status: 400 }
    );
  }

  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");

  // برای سفارش‌های حاوی کالای خارجی، هزینه‌ی ارسال/باربری همیشه دستی و بعداً
  // (با set-shipping-cost) تعیین می‌شه -- تغییرِ آدرس این‌جا فقط خودِ آدرس رو
  // عوض می‌کنه، ادمین موقعِ تعیینِ اون هزینه، مقصدِ جدید رو خودش لحاظ می‌کنه
  let newShippingMethod = order.shippingMethod;
  let newShippingCost = order.shippingCost;
  let diff = 0;

  if (!hasExternalItems) {
    const method = parsed.data.shippingMethod ?? order.shippingMethod ?? undefined;
    if (!method || !SHIPPING_METHODS.includes(method as (typeof SHIPPING_METHODS)[number])) {
      return NextResponse.json({ error: "نحوه ارسال معتبر نیست" }, { status: 400 });
    }
    if (method === "پیک موتوری" && !isTehranCity(parsed.data.newAddress.city)) {
      return NextResponse.json(
        { error: "پیک موتوری فقط برای آدرس‌های تهران ممکنه -- نحوه ارسال دیگه‌ای انتخاب کن" },
        { status: 400 }
      );
    }
    const isNoCostMethod = NO_COST_SHIPPING_METHODS.includes(method as (typeof NO_COST_SHIPPING_METHODS)[number]);
    newShippingCost = order.freeShippingApplied || isNoCostMethod ? 0 : calculateShipping(order.subtotal);
    newShippingMethod = method;
    diff = newShippingCost - (order.shippingCost ?? 0);
  }

  // اگه قراره دور جدیدی از پرداخت/رفاند روی ShippingPayment باز بشه، نباید یه
  // دورِ دیگه (مثلاً از یه RTS قبلی که هنوز تعیین‌تکلیف نشده) از قبل باز مونده باشه
  if (diff !== 0 && order.shippingPayment && order.shippingPayment.status !== "PAID") {
    return NextResponse.json(
      { error: "یه دورِ پرداختِ هزینه ارسال قبلاً برای این سفارش باز مونده -- اول اون رو تعیین‌تکلیف کن" },
      { status: 400 }
    );
  }

  const wallet = await getOrCreateWallet(order.userId);
  let walletOffset = 0;
  let assignedCard: { cardNumber: string; shebaNumber: string | null; holderName: string } | null = null;
  if (diff > 0) {
    walletOffset = Math.min(wallet.balance, diff);
    const remainder = diff - walletOffset;
    if (remainder > 0) {
      if (parsed.data.bankCardId) {
        assignedCard = await prisma.bankCard.findUnique({ where: { id: parsed.data.bankCardId } });
        if (!assignedCard) {
          return NextResponse.json({ error: "کارت بانکی یافت نشد" }, { status: 404 });
        }
      } else {
        // مثلِ set-shipping-cost -- بر اساسِ ترکیبِ سفارش، خودکار کارتِ
        // پیش‌فرضِ همون هدف انتخاب می‌شه (فالبک به قدیمی‌ترین کارتِ فعال)
        const defaultFlag = hasExternalItems ? "isDefaultForCargo" : "isDefaultForShipping";
        assignedCard =
          (await prisma.bankCard.findFirst({ where: { isActive: true, [defaultFlag]: true } })) ??
          (await prisma.bankCard.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
        if (!assignedCard) {
          return NextResponse.json(
            { error: "چون مبلغ بیشتری باید دریافت بشه، یک کارت بانکی انتخاب کن (هیچ کارتِ فعالی هم ثبت نشده)" },
            { status: 400 }
          );
        }
      }
    }
  }
  const remainder = diff > 0 ? diff - walletOffset : 0;
  const paidNow = remainder <= 0;
  const diffLabel = `${diff > 0 ? "+" : ""}${diff.toLocaleString("fa-IR")} تومان`;
  const shortId = id.slice(-8);

  const baseTotal = order.subtotal - order.discountTotal + (order.giftWrap ? GIFT_WRAP_COST : 0);
    const finalTotal = baseTotal + (newShippingCost ?? 0);

    // paymentsDeadlineAt اگر قبلاً ست شده (مثلاً دورِ باربریِ قبلی یا finalizeItemsPayment)
    // نباید باهاش بازی کنیم -- فقط اگه null هست یا گذشته (expired)، override
    // می‌کنیم. قبلاً این چک واقعاً اجرا نمی‌شد و هر تغییرِ آدرس مهلتِ معتبرِ
    // موجود رو بی‌دلیل ۴۸ ساعتِ تازه می‌کرد
    const now = new Date();
    const deadlineNeedsRefresh = !order.paymentDeadlineAt || order.paymentDeadlineAt.getTime() <= now.getTime();
    const newDeadline = diff > 0 && !paidNow && deadlineNeedsRefresh
      ? computePaymentDeadline(now, Number(await getSiteSetting(SITE_SETTING_KEYS.PAYMENT_DEADLINE_H)) || 48)
      : undefined;

    await prisma.$transaction(async (tx) => {
      // گارد همزمانی: کیف پول داخل تراکنش دوباره خوانده می‌شه
      if (diff > 0) {
        const freshWallet = await getOrCreateWallet(order.userId, tx);
        if (freshWallet.balance + (order.shippingPayment?.walletOffset ?? 0) < walletOffset) {
          throw new Error("موجودی کیف پول کافی نیست -- لطفاً دوباره تلاش کنید");
        }
      }
      await tx.order.update({
        where: { id },
        data: {
          addressId: null,
          addressSnapshot: JSON.stringify(parsed.data.newAddress),
          ...(!hasExternalItems
            ? { shippingMethod: newShippingMethod, shippingCost: newShippingCost, total: finalTotal }
            : {}),
          ...(newDeadline ? { paymentDeadlineAt: newDeadline } : {}),
        },
      });

    if (diff < 0) {
      await applyWalletTransaction(tx, {
        userId: order.userId,
        amount: -diff,
        type: "REFUND",
        description: `بازگشتِ اختلافِ هزینه ارسال بابتِ تغییرِ آدرس -- ${parsed.data.reason}`,
        orderId: order.id,
      });
    } else if (diff > 0) {
      if (walletOffset > 0) {
        await applyWalletTransaction(tx, {
          userId: order.userId,
          amount: walletOffset,
          type: "PURCHASE",
          description: `کسر از کیف پول بابتِ اختلافِ هزینه ارسال (تغییر آدرس) -- ${parsed.data.reason}`,
          orderId: order.id,
        });
      }

      await tx.shippingPayment.upsert({
        where: { orderId: id },
        create: {
          orderId: id,
          amount: Math.max(remainder, 0),
          shippingCost: diff,
          cargoCost: 0,
          walletOffset,
          status: paidNow ? "PAID" : "AWAITING_PAYMENT",
          paidAt: paidNow ? new Date() : null,
          assignedCardNumber: assignedCard?.cardNumber ?? null,
          assignedShebaNumber: assignedCard?.shebaNumber ?? null,
          assignedCardHolder: assignedCard?.holderName ?? null,
        },
        update: {
          amount: Math.max(remainder, 0),
          shippingCost: diff,
          cargoCost: 0,
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

      if (assignedCard) {
        await tx.orderPaymentEvent.create({
          data: {
            orderId: id,
            round: "shipping",
            purpose: "اختلاف هزینه ارسال بابت تغییر آدرس",
            amount: remainder,
            cardNumber: assignedCard.cardNumber,
            cardHolder: assignedCard.holderName,
            shebaNumber: assignedCard.shebaNumber,
          },
        });
      }
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        note: `آدرس سفارش توسط ادمین تغییر کرد -- ${parsed.data.reason}${
          diff !== 0 ? ` (اختلاف هزینه ارسال: ${diffLabel})` : ""
        }`,
      },
    });

    // نوتیفِ مشتری باید همراهِ خودِ تغییرِ آدرس/کسر-بازگشتِ کیف‌پول اتمیک باشه --
    // وگرنه اگه تراکنش کامیت بشه ولی این کوئری (مثلاً به‌خاطرِ قطعیِ لحظه‌ای)
    // جدا بخوره، پول/آدرس عوض شده ولی مشتری هیچ‌وقت خبردار نمی‌شه
    await tx.notification.create({
      data: {
        userId: order.userId,
        message:
          diff === 0
            ? `آدرس سفارش #${shortId} طبق درخواست شما به‌روزرسانی شد`
            : diff < 0
              ? `آدرس سفارش #${shortId} به‌روزرسانی شد -- چون هزینه ارسال کمتر شد، ${Math.abs(diff).toLocaleString("fa-IR")} تومان به کیف پولتان بازگشت داده شد`
              : paidNow
                ? `آدرس سفارش #${shortId} به‌روزرسانی شد -- اختلاف هزینه ارسال (${diff.toLocaleString("fa-IR")} تومان) کامل از موجودی کیف پولتان کسر شد`
                : `آدرس سفارش #${shortId} به‌روزرسانی شد -- برای اختلاف هزینه ارسال (${remainder.toLocaleString("fa-IR")} تومان باقی‌مانده)، لطفاً وارد صفحه‌ی سفارش خود شوید و واریز کنید`,
        link: `/orders/${id}`,
      },
    });
  });

  // logAdminAction عمداً بیرونِ تراکنشه و خودش هیچ‌وقت throw نمی‌کنه (طبقِ
  // مستندِ خودش) -- یه لاگِ حسابرسیِ گم‌شده بهتر از ریسکِ رول‌بکِ کل تغییرِ
  // آدرس به‌خاطرِ یه خطای صرفاً لاگی‌ه
  await logAdminAction({
    adminId: session.user.id,
    adminName: session.user.name ?? "",
    adminEmail: session.user.email ?? "",
    action: "ORDER_ADDRESS_CHANGED",
    targetType: "Order",
    targetId: id,
    detail: `${parsed.data.reason}${diff !== 0 ? ` (${diffLabel})` : ""}`,
  });

  const updated = await prisma.order.findUnique({ where: { id }, include: { shippingPayment: true } });
  return NextResponse.json(updated);
}

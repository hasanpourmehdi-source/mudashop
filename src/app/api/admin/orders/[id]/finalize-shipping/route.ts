import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { applyWalletTransaction, getOrCreateWallet } from "@/lib/wallet";
import { NO_COST_SHIPPING_METHODS } from "@/lib/shipping";
import { z } from "zod";

const schema = z.object({
  shippingCost: z.number().int().nonnegative().optional(),
  shippingMethod: z.string().optional(),
  bankCardId: z.string().optional(),
});

// ادمین بعد از محاسبه‌ی باربری، هزینه ارسال رو دستی وارد می‌کنه و (اگه لازم
// باشه) یه کارت بانکی برای پرداخت انتخاب می‌کنه -- هر دو تو یه اقدام واحد.
// اینجا اولین و تنها جایی‌ه که مبلغ نهایی سفارش کامل می‌شه: کیف‌پول (اگه
// مشتری موقع چک‌اوت خواسته بود) دقیقاً همین‌جا برای اولین‌بار اعمال می‌شه، چون
// قبل از این، به‌خاطر نامعلوم‌بودن هزینه ارسال، مبلغ نهایی معلوم نبود.
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

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }
  if (order.paymentStatus !== "PENDING") {
    return NextResponse.json(
      { error: "این سفارش در انتظار تعیین هزینه ارسال نیست" },
      { status: 400 }
    );
  }
  if (order.itemsNegotiationStatus === "AWAITING_CUSTOMER_REVIEW") {
    return NextResponse.json(
      { error: "منتظر بررسی و تایید مشتری روی تغییرات اقلام سفارش هستیم" },
      { status: 400 }
    );
  }

  // سفارش‌های حاوی کالای خارجی (ترندیول) هزینه ارسال واقعی‌شون فقط بعد از خرید
  // و وزن‌کشی مشخص می‌شه -- این‌جا نباید ازشون خواسته بشه (بعداً با
  // set-shipping-cost و دور دوم کارت‌به‌کارت مشخص می‌شه). برای سفارش فقط-مزون،
  // «نحوه ارسال» از قبل توی چک‌اوت توسط مشتری انتخاب و روی سفارش ذخیره شده --
  // shippingMethod توی بدنه‌ی درخواست فقط fallback سفارش‌های قدیمی/بدون نحوه‌ست
  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");
  const method = order.shippingMethod ?? parsed.data.shippingMethod ?? null;

  let finalShippingCost: number; // برای محاسبه‌ی مبلغ قابل‌پرداخت همین الان
  let persistShippingCost: number | null;
  let persistShippingMethod: string | null;

  if (order.freeShippingApplied) {
    finalShippingCost = 0;
    persistShippingCost = 0;
    persistShippingMethod = method;
  } else if (hasExternalItems) {
    finalShippingCost = 0;
    persistShippingCost = null;
    persistShippingMethod = null;
  } else {
    if (!method) {
      return NextResponse.json({ error: "نحوه ارسال مشخص نیست" }, { status: 400 });
    }
    if (NO_COST_SHIPPING_METHODS.includes(method as (typeof NO_COST_SHIPPING_METHODS)[number])) {
      // پیک موتوری/تیپاکس -- مشتری هزینه رو مستقیم به تحویل‌دهنده پرداخت می‌کنه
      finalShippingCost = 0;
    } else {
      if (parsed.data.shippingCost === undefined) {
        return NextResponse.json({ error: "هزینه ارسال را وارد کنید" }, { status: 400 });
      }
      finalShippingCost = parsed.data.shippingCost;
    }
    persistShippingCost = finalShippingCost;
    persistShippingMethod = method;
  }

  // order.total تا این لحظه فقط subtotal - discountTotal + giftWrapCost بوده
  // (بدون هزینه ارسال و بدون کیف‌پول) -- همون چیزی که در src/app/api/orders/route.ts ساخته شد
  const totalBeforeWallet = order.total + finalShippingCost;

  let walletUsed = 0;
  if (order.useWalletRequested) {
    const wallet = await getOrCreateWallet(order.userId);
    walletUsed = Math.min(wallet.balance, totalBeforeWallet);
  }
  const finalTotal = totalBeforeWallet - walletUsed;

  if (finalTotal > 0 && !parsed.data.bankCardId) {
    return NextResponse.json(
      { error: "چون مبلغی باقی مونده، یک کارت بانکی برای پرداخت انتخاب کنید" },
      { status: 400 }
    );
  }

  let assignedCard: { cardNumber: string; shebaNumber: string | null; holderName: string } | null = null;
  if (finalTotal > 0) {
    assignedCard = await prisma.bankCard.findUnique({ where: { id: parsed.data.bankCardId! } });
    if (!assignedCard) {
      return NextResponse.json({ error: "کارت بانکی یافت نشد" }, { status: 404 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (walletUsed > 0) {
      await applyWalletTransaction(tx, {
        userId: order.userId,
        amount: walletUsed,
        type: "PURCHASE",
        description: `پرداخت سفارش #${order.id.slice(-8)}`,
        orderId: order.id,
      });
    }

    const result = await tx.order.update({
      where: { id },
      data: {
        shippingCost: persistShippingCost,
        shippingMethod: persistShippingMethod,
        itemsNegotiationStatus: "AGREED",
        walletUsed,
        total: finalTotal,
        ...(finalTotal === 0
          ? { paymentStatus: "PAID", paidAt: new Date() }
          : {
              paymentStatus: "AWAITING_PAYMENT",
              paymentAuthority: `sim_${randomUUID()}`,
              assignedCardNumber: assignedCard!.cardNumber,
              assignedShebaNumber: assignedCard!.shebaNumber,
              assignedCardHolder: assignedCard!.holderName,
            }),
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: result.status,
        note:
          finalTotal === 0
            ? "هزینه ارسال صفر تعیین شد و کل مبلغ از کیف پول کسر شد"
            : "شماره کارت و هزینه ارسال برای پرداخت مشتری ارسال شد",
      },
    });

    if (finalTotal > 0) {
      await tx.orderPaymentEvent.create({
        data: {
          orderId: id,
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

  const shortId = order.id.slice(-8);
  await prisma.notification.create({
    data: {
      userId: order.userId,
      message:
        finalTotal === 0
          ? `هزینه ارسال سفارش #${shortId} مشخص شد و کل مبلغ از کیف پول شما پرداخت شد.`
          : `هزینه ارسال و مبلغ نهایی سفارش #${shortId} مشخص شد -- برای پرداخت وارد صفحه‌ی سفارش خود شوید.`,
      link: `/orders/${order.id}`,
    },
  });

  return NextResponse.json(updated);
}

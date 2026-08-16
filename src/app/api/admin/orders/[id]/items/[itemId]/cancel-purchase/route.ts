import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { applyWalletTransaction } from "@/lib/wallet";
import { computePurchaseSummary, notifyIfAllArrived } from "@/lib/orderPurchaseStatus";
import { z } from "zod";

const schema = z.object({
  reason: z.string().trim().min(1, "دلیل رو بنویسید").max(500),
});

// فاز اول: ادمین نتونست این قلم رو از فروشنده بخره (ناموجود شد و...) --
// رفاند فوریِ همون قلم به کیف‌پول. اگه بعد از این، همه‌ی اقلام خارجیِ سفارش
// (و فقط اقلام خارجی توی این سفارش باشن) کنسل شده باشن، کل سفارش لغو می‌شه
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id, itemId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  const item = order.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: "قلم سفارش یافت نشد" }, { status: 404 });
  if (item.source !== "TRENDYOL") {
    return NextResponse.json({ error: "این عملیات فقط برای اقلام خارجی معنی دارد" }, { status: 400 });
  }
  if (order.paymentStatus !== "PAID") {
    return NextResponse.json(
      { error: "این عملیات فقط بعد از پرداخت اقلام سفارش انجام می‌شود" },
      { status: 400 }
    );
  }
  if (item.purchaseStatus !== "PENDING") {
    return NextResponse.json({ error: "وضعیت خرید این قلم قبلاً مشخص شده است" }, { status: 400 });
  }

  const refundAmount = item.price * item.quantity;
  const now = new Date();

  const { summary, allArrivedMessage } = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.orderItem.update({
      where: { id: itemId },
      data: { purchaseStatus: "CANCELLED", purchaseNote: parsed.data.reason, purchaseResolvedAt: now },
    });

    if (refundAmount > 0) {
      await applyWalletTransaction(tx, {
        userId: order.userId,
        amount: refundAmount,
        type: "REFUND",
        description: `عدم خرید قلم «${item.title}» از سفارش #${order.id.slice(-8)} -- ${parsed.data.reason}`,
        orderId: order.id,
      });
    }

    const items = order.items.map((i) => (i.id === itemId ? updatedItem : i));
    const summary = computePurchaseSummary(items);
    const wholeOrderIsExternalOnly = order.items.every((i) => i.source === "TRENDYOL");

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        note: `قلم «${item.title}» قابل خریداری‌شدن نبود -- ${parsed.data.reason} (وجه به کیف پول بازگشت شد)`,
      },
    });

    let allArrivedMessage: string | null = null;
    if (wholeOrderIsExternalOnly && summary.allCancelled) {
      if (order.couponCode) {
        await tx.coupon.updateMany({
          where: { code: order.couponCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
      await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: "CANCELLED",
          // همون عبارت دقیقِ fallback مربوطه توی OrderTracking.tsx رو عمداً
          // این‌جا هم تکرار می‌کنیم (نه یه فرمول‌بندیِ نزدیک ولی متفاوت) --
          // وگرنه مشتری برای دقیقاً همون اتفاق، دو متن متفاوت می‌بینه بسته به
          // اینکه سفارش کلاً خارجی بوده یا کالای مزون هم داشته
          note: "هیچ‌کدوم از اقلام قابل خریداری‌شدن نبودن -- کل سفارش لغو شد",
        },
      });
    } else {
      // اگه این کنسلی دقیقاً آخرین قلمِ باقی‌مونده بود (بقیه قبلاً به نتیجه‌ی
      // نهایی رسیده بودن)، مشتری باید بفهمه بررسی همه‌ی اقلام تموم شده
      ({ message: allArrivedMessage } = await notifyIfAllArrived(tx, order, items));
    }

    return { summary, allArrivedMessage };
  });

  await prisma.notification.create({
    data: {
      userId: order.userId,
      message: summary.allCancelled
        ? `متأسفانه هیچ‌کدوم از اقلام سفارش #${id.slice(-8)} قابل خریداری‌شدن نبودن -- سفارش لغو و وجه بازگشت داده شد`
        : `متأسفانه یکی از اقلام سفارش #${id.slice(-8)} قابل خریداری‌شدن نبود و وجهش بازگشت داده شد (${summary.purchased} از ${summary.total} کالا خریداری شد)`,
      link: `/orders/${id}`,
    },
  });

  if (allArrivedMessage) {
    await prisma.notification.create({
      data: { userId: order.userId, message: allArrivedMessage, link: `/orders/${id}` },
    });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyWalletTransaction } from "@/lib/wallet";
import {
  PURCHASE_OUTCOME_LABELS,
  cascadeCancelIfAllVoided,
  computePurchaseSummary,
  notifyIfAllArrived,
} from "@/lib/orderPurchaseStatus";
import { autoSettleShippingCostIfEnabled } from "@/lib/orderFinalizePayment";
import type { OrderItemPurchaseStatus } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  decision: z.enum(["KEEP", "REFUND"]),
});

// وقتی ادمین موقع resolve یه قلم رو با مغایرت (سایز/رنگ اشتباه) علامت می‌زنه،
// به‌جای رفاندِ فوریِ خودکار، این‌جا از خود مشتری می‌پرسیم: با همین مورد
// راضیه (نگهش می‌داره، بدون رفاند) یا ترجیح می‌ده پولش برگرده (وضعیتِ نهاییِ
// همون مغایرتِ اصلی ثبت می‌شه + رفاندِ فوری، دقیقاً مثل قبل)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id, itemId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  const item = order.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: "قلم سفارش یافت نشد" }, { status: 404 });
  if (item.purchaseStatus !== "AWAITING_CUSTOMER_DECISION" || !item.mismatchOutcome) {
    return NextResponse.json({ error: "این قلم منتظر تصمیمی نیست" }, { status: 400 });
  }

  const keep = parsed.data.decision === "KEEP";
  const mismatchLabel = PURCHASE_OUTCOME_LABELS[item.mismatchOutcome] ?? item.mismatchOutcome;
  const refundAmount = keep ? 0 : (item.purchasePriceActual ?? item.price) * item.quantity;
  const now = new Date();

  const { cascaded, allArrivedMessage } = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.orderItem.update({
      where: { id: itemId },
      data: {
        purchaseStatus: keep ? "RECEIVED" : (item.mismatchOutcome as OrderItemPurchaseStatus),
        mismatchOutcome: null,
        purchaseResolvedAt: now,
      },
    });

    if (refundAmount > 0) {
      await applyWalletTransaction(tx, {
        userId: order.userId,
        amount: refundAmount,
        type: "REFUND",
        description: `${mismatchLabel} (پس از تصمیم مشتری): قلم «${item.title}» از سفارش #${order.id.slice(-8)}`,
        orderId: order.id,
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        note: keep
          ? `مشتری با مغایرتِ قلم «${item.title}» (${mismatchLabel}) موافقت کرد و همون کالا رو نگه می‌داره`
          : `مشتری مغایرتِ قلم «${item.title}» (${mismatchLabel}) رو نپذیرفت -- وجه به کیف پول بازگشت شد`,
      },
    });

    const itemsAfter = order.items.map((i) => (i.id === itemId ? updatedItem : i));

    // اگه مشتری رفاند رو انتخاب کرد (نه نگه‌داشتن) و با همین، همه‌ی اقلامِ
    // خارجیِ یه سفارشِ کاملاً-خارجی به یه نتیجه‌ی رفاندی رسیدن، کل سفارش لغو می‌شه
    const cascaded = await cascadeCancelIfAllVoided(tx, order, itemsAfter);
    let allArrivedMessage: string | null = null;
    if (!cascaded) {
      ({ message: allArrivedMessage } = await notifyIfAllArrived(tx, order, itemsAfter));
      if (computePurchaseSummary(itemsAfter).allArrived) {
        await autoSettleShippingCostIfEnabled(tx, id);
      }
    }

    return { cascaded, allArrivedMessage };
  });

  if (cascaded) {
    await prisma.notification.create({
      data: {
        userId: order.userId,
        message: `همه‌ی اقلام سفارش #${id.slice(-8)} نهایتاً به دستتون نرسید -- سفارش لغو و وجه همه‌ی اقلام بازگشت داده شد`,
        link: `/orders/${id}`,
      },
    });
  } else if (allArrivedMessage) {
    await prisma.notification.create({
      data: { userId: order.userId, message: allArrivedMessage, link: `/orders/${id}` },
    });
  }

  return NextResponse.json({ ok: true });
}

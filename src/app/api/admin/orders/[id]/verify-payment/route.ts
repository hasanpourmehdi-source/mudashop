import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { restoreOrderResources } from "@/lib/orderResources";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

// تأیید/رد فیش پرداخت کارت‌به‌کارت توسط ادمین. رد = لغو کامل سفارش (نه فقط
// علامت‌زدن) -- موجودی/کوپن/کیف‌پول رزروشده خودکار برمی‌گردن، دقیقاً مثل مسیر
// لغو سفارش توسط مشتری (restoreOrderResources مشترک). مشتری برای تلاش دوباره
// باید سفارش تازه ثبت کنه، نه resubmit روی همین سفارش.
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
    return NextResponse.json({ error: "عملیات نامعتبر است" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }
  if (order.paymentStatus !== "AWAITING_VERIFICATION") {
    return NextResponse.json(
      { error: "این سفارش در انتظار تأیید فیش نیست" },
      { status: 400 }
    );
  }

  const reason = parsed.data.reason?.trim() ?? "";
  if (parsed.data.action === "reject" && !reason) {
    return NextResponse.json({ error: "لطفاً دلیل رد پرداخت را بنویسید" }, { status: 400 });
  }

  const shortId = id.slice(-8);

  if (parsed.data.action === "approve") {
    const now = new Date();
    const updated = await prisma.order.update({
      where: { id },
      data: { paymentStatus: "PAID", paidAt: now },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId: id, status: updated.status, note: "پرداخت اقلام سفارش توسط ادمین تأیید شد" },
    });
    const latestItemsEvent = await prisma.orderPaymentEvent.findFirst({
      where: { orderId: id, round: "items", paidAt: null },
      orderBy: { assignedAt: "desc" },
    });
    if (latestItemsEvent) {
      await prisma.orderPaymentEvent.update({ where: { id: latestItemsEvent.id }, data: { paidAt: now } });
    }
    await prisma.notification.create({
      data: {
        userId: order.userId,
        message: `فیش پرداخت سفارش #${shortId} تأیید شد و سفارش شما در حال آماده‌سازیه.`,
        link: `/orders/${id}`,
      },
    });
    return NextResponse.json(updated);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await restoreOrderResources(tx, order);
    const result = await tx.order.update({
      where: { id },
      data: { status: "CANCELLED", paymentStatus: "FAILED" },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: id, status: "CANCELLED", note: `فیش پرداخت رد شد توسط ادمین -- ${reason}` },
    });
    await tx.notification.create({
      data: {
        userId: order.userId,
        message: `فیش پرداخت سفارش #${shortId} تأیید نشد و سفارش لغو شد. مبلغ رزروشده به کیف پول/کوپن شما بازگشت.`,
        link: `/orders/${id}`,
      },
    });
    return result;
  });

  return NextResponse.json(updated);
}

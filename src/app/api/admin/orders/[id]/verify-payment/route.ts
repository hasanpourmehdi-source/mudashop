import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { restoreOrderResources } from "@/lib/orderResources";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { approveItemsPayment } from "@/lib/orderPaymentApproval";
import { logAdminAction } from "@/lib/adminAudit";
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
  const { ok, session } = await requireAdmin("PAYMENTS");
  if (!ok || !session) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

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
    await approveItemsPayment(id);
    await logAdminAction({
      adminId: session.user.id,
      adminName: session.user.name ?? "",
      adminEmail: session.user.email ?? "",
      action: "PAYMENT_APPROVED",
      targetType: "Order",
      targetId: id,
    });
    const updated = await prisma.order.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(updated);
  }

  // گاردِ همزمانی: چکِ بالا (خط ۴۱) روی خواندنِ اولیه‌ست، نه اتمیک -- اگه یه
  // ادمینِ دیگه هم‌زمان همین سفارش رو approve کنه (که خودش atomic guard داره،
  // orderPaymentApproval.ts)، بدونِ این updateMany این تراکنش بی‌قیدوشرط
  // منابع رو دوباره برمی‌گردوند و سفارشِ تازه‌PAIDشده رو به FAILED/CANCELLED
  // برمی‌گردوند -- رفاندِ تکراری + گم‌شدنِ تأییدِ ادمینِ دیگه
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id, paymentStatus: "AWAITING_VERIFICATION" },
      data: { status: "CANCELLED", paymentStatus: "FAILED" },
    });
    if (claimed.count === 0) return null;

    await restoreOrderResources(tx, order);
    const result = await tx.order.findUniqueOrThrow({ where: { id } });
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

  if (!updated) {
    return NextResponse.json(
      { error: "این سفارش قبلاً توسط ادمینِ دیگری بررسی/تأیید شده است" },
      { status: 409 }
    );
  }

  await notifyCustomerOutbound({
    userId: order.userId,
    eventType: "ORDER_CANCELLED",
    title: `پرداخت سفارش #${shortId} تأیید نشد`,
    body: `فیش پرداخت سفارش #${shortId} تأیید نشد و سفارش لغو شد. مبلغ رزروشده به کیف پول/کوپن شما بازگشت.`,
  });

  await logAdminAction({
    adminId: session.user.id,
    adminName: session.user.name ?? "",
    adminEmail: session.user.email ?? "",
    action: "PAYMENT_REJECTED",
    targetType: "Order",
    targetId: id,
    detail: reason,
  });

  return NextResponse.json(updated);
}

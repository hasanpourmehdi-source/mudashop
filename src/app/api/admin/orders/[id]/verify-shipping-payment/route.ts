import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { approveShippingPayment } from "@/lib/orderPaymentApproval";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

// تأیید/رد فیش دور دوم (هزینه ارسال سفارش خارجی). برخلاف verify-payment (دور
// اول)، رد اینجا به‌معنی لغو کل سفارش نیست -- سفارش اصلی قبلاً پرداخت و در حال
// آماده‌سازی/تحویله؛ رد فقط همین درخواست هزینه ارسال رو FAILED می‌کنه تا ادمین
// بتونه از set-shipping-cost با کارت یا مبلغ دیگه دوباره تلاش کنه
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

  const shippingPayment = await prisma.shippingPayment.findUnique({
    where: { orderId: id },
    include: { order: { select: { userId: true, status: true } } },
  });
  if (!shippingPayment) {
    return NextResponse.json({ error: "درخواست هزینه ارسال یافت نشد" }, { status: 404 });
  }
  if (shippingPayment.status !== "AWAITING_VERIFICATION") {
    return NextResponse.json({ error: "این پرداخت در انتظار تأیید فیش نیست" }, { status: 400 });
  }

  const reason = parsed.data.reason?.trim() ?? "";
  if (parsed.data.action === "reject" && !reason) {
    return NextResponse.json({ error: "لطفاً دلیل رد پرداخت را بنویسید" }, { status: 400 });
  }

  if (parsed.data.action === "approve") {
    await approveShippingPayment(id);
    const updated = await prisma.shippingPayment.findUniqueOrThrow({ where: { orderId: id } });
    return NextResponse.json(updated);
  }

  // گاردِ همزمانی: چکِ بالا روی خواندنِ اولیه‌ست، نه اتمیک -- اگه یه ادمینِ
  // دیگه هم‌زمان approve کنه (که atomic guard داره، orderPaymentApproval.ts)،
  // بدونِ این updateMany این‌جا بی‌قیدوشرط ردیفِ تازه‌PAIDشده رو FAILED می‌کرد
  const claimed = await prisma.shippingPayment.updateMany({
    where: { orderId: id, status: "AWAITING_VERIFICATION" },
    data: { status: "FAILED" },
  });
  if (claimed.count === 0) {
    return NextResponse.json(
      { error: "این پرداخت قبلاً توسط ادمینِ دیگری بررسی/تأیید شده است" },
      { status: 409 }
    );
  }
  const updated = await prisma.shippingPayment.findUniqueOrThrow({ where: { orderId: id } });
  await prisma.orderStatusHistory.create({
    data: {
      orderId: id,
      status: shippingPayment.order.status,
      note: `فیش هزینه ارسال/باربری رد شد توسط ادمین -- ${reason}`,
    },
  });
  const shortId = id.slice(-8);
  await prisma.notification.create({
    data: {
      userId: shippingPayment.order.userId,
      message: `فیش هزینه ارسال سفارش #${shortId} تأیید نشد. لطفاً منتظر تعیین مجدد هزینه توسط ادمین باشید.`,
      link: `/orders/${id}`,
    },
  });

  return NextResponse.json(updated);
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { approveShippingPayment } from "@/lib/orderPaymentApproval";
import { getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { acceptUpload } from "@/lib/uploadStorage";
import { RECEIPT_UPLOAD_SPEC } from "@/lib/uploadSpecs";

// آپلود فیش دور دوم (هزینه ارسال سفارش خارجی) -- دقیقاً عین
// /api/payment/[authority]/receipt ولی روی ShippingPayment، کلید‌شده با orderId
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { shippingPayment: true, user: { select: { name: true, email: true } } },
  });

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }
  if (!order.shippingPayment || order.shippingPayment.status !== "AWAITING_PAYMENT") {
    return NextResponse.json({ error: "این پرداخت در انتظار ارسال فیش نیست" }, { status: 409 });
  }

  const formData = await req.formData();
  const uploaded = await acceptUpload(formData, RECEIPT_UPLOAD_SPEC);
  if ("error" in uploaded) return NextResponse.json({ error: uploaded.error }, { status: 400 });
  const receiptUrl = uploaded.url;

  await prisma.shippingPayment.update({
    where: { orderId: id },
    data: {
      receiptImage: receiptUrl,
      receiptSubmittedAt: new Date(),
      status: "AWAITING_VERIFICATION",
    },
  });

  await prisma.orderStatusHistory.create({
    data: { orderId: id, status: order.status, note: "فیش هزینه ارسال/باربری توسط مشتری ارسال شد" },
  });

  if (await getSiteSettingBool(SITE_SETTING_KEYS.SKIP_PAYMENT_VERIFICATION)) {
    await approveShippingPayment(id);
  } else {
    const shortId = order.id.slice(-8);
    await notifyAdminsOnce(
      `فیش هزینه ارسال سفارش #${shortId}`,
      `فیش هزینه ارسال سفارش #${shortId} توسط ${order.user.name ?? order.user.email} ارسال شد -- مبلغ ${order.shippingPayment.amount.toLocaleString(
        "fa-IR"
      )} تومان. برای بررسی به پنل سفارش‌ها مراجعه کنید.`,
      "/admin/orders"
    );
  }

  return NextResponse.json({ success: true, orderId: order.id });
}

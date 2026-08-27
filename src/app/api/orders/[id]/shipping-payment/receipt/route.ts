import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { approveShippingPayment } from "@/lib/orderPaymentApproval";
import { getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileMatchesDeclaredType } from "@/lib/fileSignature";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // ۵ مگابایت

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
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "فرمت فایل مجاز نیست (فقط jpg, png, webp, gif)" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "receipts");
  await mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!fileMatchesDeclaredType(buffer, file.type)) {
    return NextResponse.json({ error: "فایل ارسالی معتبر نیست" }, { status: 400 });
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(uploadsDir, filename), buffer);

  const receiptUrl = `/uploads/receipts/${filename}`;

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

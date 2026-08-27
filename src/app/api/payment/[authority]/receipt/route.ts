import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { SHIPPING_METHODS, availableShippingMethods } from "@/lib/shipping";
import { approveItemsPayment } from "@/lib/orderPaymentApproval";
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

// آپلود عکس فیش واریزی کارت‌به‌کارت -- بلافاصله بعد از آپلود، سفارش به حالت
// «منتظر بررسی ادمین» می‌ره و همه‌ی ادمین‌ها اعلان می‌گیرن (زنگوله بالای هدر)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ authority: string }> }
) {
  const { authority } = await params;
  const order = await prisma.order.findUnique({
    where: { paymentAuthority: authority },
    include: { user: { select: { name: true, email: true, isGuest: true } } },
  });

  if (!order) {
    return NextResponse.json({ error: "تراکنش یافت نشد" }, { status: 404 });
  }

  // سفارشِ مهمان: هیچ سشنی برای چک‌کردن وجود نداره -- خودِ authority (یه
  // UUIDِ تصادفی) کافیه، دقیقاً مثل GET همین مسیر. سفارشِ کاربرِ ثبت‌نام‌کرده
  // همچنان باید مالِ همون سشن باشه
  if (!order.user.isGuest) {
    const session = await auth();
    if (!session?.user?.id || order.userId !== session.user.id) {
      return NextResponse.json({ error: "تراکنش یافت نشد" }, { status: 404 });
    }
  }

  if (order.paymentStatus === "PENDING") {
    return NextResponse.json(
      { error: "هنوز شماره کارت برای این سفارش تخصیص داده نشده است", orderId: order.id },
      { status: 409 }
    );
  }
  if (order.paymentStatus !== "AWAITING_PAYMENT") {
    return NextResponse.json(
      { error: "این تراکنش قبلاً پردازش شده است", orderId: order.id },
      { status: 409 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const shippingMethod = formData.get("shippingMethod");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
  }

  // نحوه ارسال سفارش‌های فقط-مزون از قبل توی چک‌اوت گرفته شده (order.shippingMethod
  // پره)؛ سفارش‌های حاوی کالای خارجی هنوز نحوه‌ی ارسالشون معلوم نیست (چون قبل
  // از خرید/وزن‌کشی هیچ‌کس نمی‌دونه اصلاً کالا می‌رسه یا نه) -- برای همینا همین‌جا،
  // موقع واریز هزینه‌ی اصلی سفارش، ازشون می‌پرسیم
  let validatedShippingMethod = order.shippingMethod;
  if (!validatedShippingMethod) {
    if (typeof shippingMethod !== "string" || !SHIPPING_METHODS.includes(shippingMethod as (typeof SHIPPING_METHODS)[number])) {
      return NextResponse.json({ error: "لطفاً نحوه ارسال را انتخاب کنید" }, { status: 400 });
    }
    const addressSnapshot = JSON.parse(order.addressSnapshot) as { city: string };
    const allowedMethods = availableShippingMethods(addressSnapshot.city);
    if (!allowedMethods.includes(shippingMethod as (typeof allowedMethods)[number])) {
      return NextResponse.json({ error: "این نحوه ارسال برای آدرس شما در دسترس نیست" }, { status: 400 });
    }
    validatedShippingMethod = shippingMethod;
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

  await prisma.order.update({
    where: { id: order.id },
    data: {
      receiptImage: receiptUrl,
      receiptSubmittedAt: new Date(),
      paymentStatus: "AWAITING_VERIFICATION",
      shippingMethod: validatedShippingMethod,
    },
  });

  await prisma.orderStatusHistory.create({
    data: { orderId: order.id, status: order.status, note: "فیش پرداخت توسط مشتری ارسال شد" },
  });

  // اگه از تنظیمات «تأییدِ فیش‌های واریزی» خاموش باشه، به‌جای موندن روی
  // AWAITING_VERIFICATION، همون لحظه خودِ سیستم تأییدش می‌کنه (بدونِ منتظرِ
  // کلیکِ ادمین) -- دقیقاً همون کاری که verify-payment با action=approve می‌کنه
  if (await getSiteSettingBool(SITE_SETTING_KEYS.SKIP_PAYMENT_VERIFICATION)) {
    await approveItemsPayment(order.id);
  } else {
    const shortId = order.id.slice(-8);
    await notifyAdminsOnce(
      `فیش پرداخت سفارش #${shortId}`,
      `فیش پرداخت سفارش #${shortId} توسط ${order.user.name ?? order.user.email} ارسال شد -- مبلغ ${order.total.toLocaleString(
        "fa-IR"
      )} تومان. برای بررسی به پنل سفارش‌ها مراجعه کنید.`,
      "/admin/orders"
    );
  }

  return NextResponse.json({ success: true, orderId: order.id });
}

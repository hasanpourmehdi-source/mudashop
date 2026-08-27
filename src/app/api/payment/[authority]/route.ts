import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ authority: string }> }
) {
  const { authority } = await params;
  const order = await prisma.order.findUnique({
    where: { paymentAuthority: authority },
    include: { user: { select: { isGuest: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "تراکنش یافت نشد" }, { status: 404 });
  }

  // سفارشِ مهمان: هیچ سشنی برای چک‌کردن وجود نداره -- خودِ authority (یه
  // UUIDِ تصادفی، دقیقاً مثل توکنِ درگاه‌های واقعی) کافیه. سفارشِ کاربرِ
  // ثبت‌نام‌کرده همچنان باید مالِ همون سشن باشه، وگرنه هرکسی با حدسِ authority
  // می‌تونست وضعیتِ پرداختِ حساب یکی دیگه رو ببینه
  if (!order.user.isGuest) {
    const session = await auth();
    if (!session?.user?.id || order.userId !== session.user.id) {
      return NextResponse.json({ error: "تراکنش یافت نشد" }, { status: 404 });
    }
  }

  // اگه نحوه ارسال هنوز مشخص نشده (سفارش‌های حاوی کالای خارجی -- توی چک‌اوت
  // ازشون پرسیده نمی‌شه)، صفحه باید بتونه گزینه‌های در دسترس رو بر اساس شهر
  // آدرس محدود کنه (مثلاً پیک موتوری فقط برای تهران)
  const addressSnapshot = JSON.parse(order.addressSnapshot) as { city: string };
  return NextResponse.json({
    orderId: order.id,
    isGuest: order.user.isGuest,
    amount: order.total,
    paymentStatus: order.paymentStatus,
    receiptImage: order.receiptImage,
    bankCardNumber: order.assignedCardNumber,
    bankShebaNumber: order.assignedShebaNumber,
    bankCardHolder: order.assignedCardHolder,
    city: addressSnapshot.city,
    shippingMethod: order.shippingMethod,
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCustomerCancelOrder } from "@/lib/orderCancellation";

// ثبت درخواست لغو توسط مشتری (فقط برای سفارش‌های حاوی کالای خارجی که خریدِ
// واقعیشون هنوز شروع نشده). برخلاف لغو مستقیم سفارش مزون، اینجا هیچ تغییری
// روی خودِ سفارش/منابع اعمال نمی‌شه -- فقط یه رکورد درخواست (PENDING) ثبت
// می‌شه که ادمین باید صریحاً تأیید یا ردش کنه. تأیید یعنی لغو کامل + بازگشت
// منابع؛ رد یعنی سفارش دست‌نخورده می‌مونه.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!reason) {
    return NextResponse.json({ error: "لطفاً دلیل لغو را بنویسید" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      cancellationRequest: true,
    },
  });

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "این سفارش قبلاً لغو شده است" }, { status: 400 });
  }

  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");

  // فقط سفارش‌های خارجی که هنوز خریدِ واقعی‌شون شروع نشده، این مسیر رو دارن.
  // برای مزون دکمه‌ی لغو مستقیم باید استفاده بشه نه درخواست.
  const policy = canCustomerCancelOrder({
    hasExternalItems,
    paymentStatus: order.paymentStatus,
    status: order.status,
    itemPurchaseStatuses: hasExternalItems ? order.items.map((i) => i.purchaseStatus) : undefined,
  });
  if (policy.mode !== "request") {
    if (policy.mode === "direct") {
      return NextResponse.json(
        { error: "این سفارش نیازی به درخواست لغو ندارد؛ می‌توانید مستقیم لغو کنید" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: policy.message }, { status: 400 });
  }

  // اگه قبلاً درخواست PENDING/APPROVED داره، درخواست دوم نزن -- فقط درخواستِ
  // REJECTED شده قابل جایگزینی با درخواست جدید هست (مثل الگوی return request)
  if (order.cancellationRequest && order.cancellationRequest.status !== "REJECTED") {
    return NextResponse.json(
      { error: "برای این سفارش قبلاً درخواست لغو ثبت شده است؛ منتظر بررسی ادمین باشید" },
      { status: 409 }
    );
  }

  const previousRejectedId =
    order.cancellationRequest?.status === "REJECTED" ? order.cancellationRequest.id : null;

  if (previousRejectedId) {
    await prisma.cancellationRequest.delete({ where: { id: previousRejectedId } });
  }

  const [cancellationRequest] = await prisma.$transaction([
    prisma.cancellationRequest.create({
      data: {
        orderId: order.id,
        userId: session.user.id,
        reason,
      },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: previousRejectedId
          ? "مشتری بعد از رد درخواست قبلی، دوباره درخواست لغو ثبت کرد"
          : "مشتری درخواست لغو سفارش ثبت کرد",
      },
    }),
  ]);

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        message: `درخواست لغو جدید روی سفارش #${id.slice(-8)}`,
        link: `/admin/orders/${id}`,
      })),
    });
  }

  return NextResponse.json(cancellationRequest, { status: 201 });
}
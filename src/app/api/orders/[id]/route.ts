import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { restoreOrderResources } from "@/lib/orderResources";
import { canCustomerCancelOrder } from "@/lib/orderCancellation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      returnRequest: true,
      shippingPayment: true,
    },
  });

  // IDOR-safe: فقط صاحب سفارش (یا ادمین) می‌تونه ببینتش
  if (!order || (order.userId !== session.user.id && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  // OrderTracking.tsx هر ۸ ثانیه همین پاسخ رو جای‌گزین state فعلیش می‌کنه --
  // اگه hasExternalItems این‌جا نباشه، بعد از اولین poll این فیلد undefined
  // می‌شه و برچسب وضعیت به‌اشتباه عوض می‌شه (چون customerOrderStatusLabel
  // باهاش شاخه فرق می‌کنه)
  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");

  return NextResponse.json({ ...order, hasExternalItems });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.action !== "cancel") {
    return NextResponse.json({ error: "عملیات نامعتبر است" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!reason) {
    return NextResponse.json({ error: "لطفاً دلیل لغو را بنویسید" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "این سفارش قبلاً لغو شده است" }, { status: 400 });
  }

  // سفارش حاوی کالای خارجی: حتی وقتی پول تسویه شده و خریدِ واقعی هنوز شروع
  // نشده (در صف خرید)، لغو فقط به شکل «درخواست» که ادمین تأیید کنه ممکنه --
  // لغو مستقیم اصلاً وجود نداره (رجوع کن به cancel-request/route.ts). این
  // PATCH فقط لغو مستقیم سفارش خالص مزون (قبل از ارسال) رو اجرا می‌کنه؛
  // تصمیم‌گیری در orderCancellation.ts جداست تا تست‌پذیر باشه.
  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");
  const policy = canCustomerCancelOrder({
    hasExternalItems,
    paymentStatus: order.paymentStatus,
    status: order.status,
    itemPurchaseStatuses: hasExternalItems ? order.items.map((i) => i.purchaseStatus) : undefined,
  });
  if (policy.mode !== "direct") {
    if (policy.mode === "request") {
      return NextResponse.json(
        { error: "این سفارش کالای خارجی دارد؛ لغو آن فقط با تأیید ادمین انجام می‌شود (از دکمه «درخواست لغو سفارش» استفاده کنید)" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: policy.message }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await restoreOrderResources(tx, order);

    const result = await tx.order.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: { items: true },
    });

    await tx.orderStatusHistory.create({
      data: { orderId: id, status: "CANCELLED", note: `لغو توسط مشتری -- ${reason}` },
    });

    await tx.notification.create({
      data: {
        userId: order.userId,
        message: `سفارش #${id.slice(-8)} لغو شد و مبلغ به کیف پول شما برگشت.`,
        link: `/orders/${id}`,
      },
    });

    return result;
  });

  return NextResponse.json(updated);
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { restoreOrderResources } from "@/lib/orderResources";

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

  // سفارش خارجی: بعد از تأیید پرداخت اقلام (paymentStatus=PAID)، ادمین واقعاً
  // از ترندیول خریداری کرده -- دیگه قابل لغو نیست، صرف‌نظر از status فعلی
  // (ممکنه هنوز PENDING/PROCESSING باشه). سفارش مزون طبق قانون قبلی: فقط قبل
  // از ارسال قابل لغوئه
  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");
  if (hasExternalItems) {
    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        {
          error:
            "چون این سفارش کالای خارجی دارد و پرداختش تسویه شده، ممکنه همین الان در حال خریداری از فروشنده باشیم -- کل سفارش (حتی اگه شامل کالای مزون هم باشه) دیگه قابل لغو نیست. بعد از دریافت می‌تونید درخواست مرجوعی ثبت کنید.",
        },
        { status: 400 }
      );
    }
  } else if (order.status === "SHIPPED" || order.status === "DELIVERED") {
    return NextResponse.json(
      { error: "سفارش ارسال‌شده قابل لغو نیست" },
      { status: 400 }
    );
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

    return result;
  });

  return NextResponse.json(updated);
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// تأیید بدون تغییر: مشتری اقلامی که ادمین ویرایش کرده رو همون‌طور که هست قبول
// می‌کنه -- سفارش برمی‌گرده به حالت AGREED و ادمین می‌تونه هزینه ارسال رو نهایی کنه
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }
  if (order.paymentStatus !== "PENDING" || order.itemsNegotiationStatus !== "AWAITING_CUSTOMER_REVIEW") {
    return NextResponse.json({ error: "در حال حاضر نیازی به تأیید نیست" }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { itemsNegotiationStatus: "AGREED" },
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        message: `مشتری تغییرات اقلام سفارش #${id.slice(-8)} رو تأیید کرد.`,
        link: `/admin/orders/${id}`,
      })),
    });
  }

  return NextResponse.json(updated);
}

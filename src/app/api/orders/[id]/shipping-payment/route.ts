import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { shippingPayment: true } });

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }
  if (!order.shippingPayment) {
    return NextResponse.json({ error: "هنوز هزینه ارسال این سفارش تعیین نشده است" }, { status: 404 });
  }

  const sp = order.shippingPayment;
  return NextResponse.json({
    orderId: order.id,
    amount: sp.amount,
    shippingCost: sp.shippingCost,
    cargoCost: sp.cargoCost,
    walletOffset: sp.walletOffset,
    status: sp.status,
    receiptImage: sp.receiptImage,
    bankCardNumber: sp.assignedCardNumber,
    bankShebaNumber: sp.assignedShebaNumber,
    bankCardHolder: sp.assignedCardHolder,
  });
}

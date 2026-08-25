import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

// خارج‌کردنِ یک قلم از محموله (قبل از نهایی‌شدن)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id, itemId } = await params;
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (shipment?.shippedAt) {
    return NextResponse.json({ error: "این محموله نهایی شده و قابل تغییر نیست" }, { status: 400 });
  }

  await prisma.orderItem.updateMany({
    where: { id: itemId, shipmentId: id },
    data: { shipmentId: null },
  });
  return NextResponse.json({ success: true });
}

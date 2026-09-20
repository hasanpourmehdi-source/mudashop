import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const verifySchema = z.object({
  verifyStatus: z.enum(["CONFIRMED", "REPLACED"]),
  verifiedUrl: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id, itemId } = await params;
  const body = await req.json();
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  const item = order.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: "قلم سفارش یافت نشد" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      // update this item's verify status
      const updateData: {
        verifyStatus: "CONFIRMED" | "REPLACED";
        verifiedUrl?: string;
        purchaseNote?: string;
      } = { verifyStatus: parsed.data.verifyStatus };
      if (parsed.data.verifyStatus === "REPLACED" && parsed.data.verifiedUrl) {
        updateData.verifiedUrl = parsed.data.verifiedUrl;
      }
      if (parsed.data.reason) {
        updateData.purchaseNote = `${item.purchaseNote ?? ""} ${parsed.data.reason}`.trim();
      }
      await tx.orderItem.update({
        where: { id: itemId },
        data: updateData,
      });

      // check if ALL items in this order are now verified
      const allItemsVerified = await tx.orderItem.count({
        where: { orderId: id, verifyStatus: "PENDING" },
      }) === 0;

      if (allItemsVerified) {
        // automatically set order to AGREED so it can proceed to payment
        await tx.order.update({
          where: { id },
          data: { itemsNegotiationStatus: "AGREED" },
        });
        // also notify admins that the order is ready for payment
        const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              message: `سفارش #${id.slice(-8)} تمام اقلام‌تایید شد و آماده پرداخت است.`,
              link: `/admin/orders/${id}`,
            })),
          });
        }
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در تایید قلم" },
      { status: 400 }
    );
  }

  const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  return NextResponse.json(updated);
}
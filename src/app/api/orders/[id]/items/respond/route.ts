import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustVariantStockForQuantityChange } from "@/lib/orderResources";
import { recomputeOrderTotals } from "@/lib/orderTotals";
import { markAwaitingAdminReview } from "@/lib/orderNegotiation";
import { z } from "zod";

const schema = z.object({
  items: z.array(z.object({ id: z.string(), quantity: z.number().int().positive() })).default([]),
  removedItemIds: z.array(z.string()).default([]),
});

// پاسخ دسته‌ای مشتری به تغییرات اقلامی که ادمین اعمال کرده -- به‌جای این‌که
// هر ویرایش رو جدا بفرسته (و بعد از اولین‌بار قفل بشه، چون نوبت ادمین می‌شه)،
// همه‌ی تغییرات (چند قلم با هم) با یه درخواست ثبت می‌شن
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }
  if (order.paymentStatus !== "PENDING" || order.itemsNegotiationStatus !== "AWAITING_CUSTOMER_REVIEW") {
    return NextResponse.json(
      { error: "در حال حاضر امکان ویرایش اقلام این سفارش نیست" },
      { status: 400 }
    );
  }

  const itemsById = new Map(order.items.map((i) => [i.id, i]));
  for (const upd of parsed.data.items) {
    if (!itemsById.has(upd.id)) {
      return NextResponse.json({ error: "قلم سفارش نامعتبر است" }, { status: 400 });
    }
  }
  for (const rid of parsed.data.removedItemIds) {
    if (!itemsById.has(rid)) {
      return NextResponse.json({ error: "قلم سفارش نامعتبر است" }, { status: 400 });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const upd of parsed.data.items) {
        if (parsed.data.removedItemIds.includes(upd.id)) continue; // هم ویرایش هم حذف -- حذف اولویت داره
        const item = itemsById.get(upd.id)!;
        if (item.source === "MAZON" && item.variantId) {
          await adjustVariantStockForQuantityChange(tx, item.variantId, upd.quantity - item.quantity);
        }
        await tx.orderItem.update({ where: { id: upd.id }, data: { quantity: upd.quantity } });
      }

      for (const rid of parsed.data.removedItemIds) {
        const item = itemsById.get(rid)!;
        if (item.source === "MAZON" && item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
        await tx.orderItem.delete({ where: { id: rid } });
      }

      await recomputeOrderTotals(tx, id);
      await markAwaitingAdminReview(tx, id);
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ثبت تغییرات" },
      { status: 400 }
    );
  }

  const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  return NextResponse.json(updated);
}

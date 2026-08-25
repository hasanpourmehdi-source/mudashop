import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { adjustVariantStockForQuantityChange } from "@/lib/orderResources";
import { recomputeOrderTotals } from "@/lib/orderTotals";
import { markAwaitingCustomerReview } from "@/lib/orderNegotiation";
import { z } from "zod";

const schema = z.object({
  quantity: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  reason: z.string().max(500).optional(),
  // لینک تامین‌کننده‌ی دوم -- کاملاً داخلی/فقط-ادمین، هیچ‌وقت به مشتری نمایش
  // داده نمی‌شه (نه توی این درخواست چیزی به مشتری می‌ره، نه هیچ‌جای دیگه)
  secondarySourceUrl: z.string().trim().url("لینک معتبر نیست").max(1000).optional().or(z.literal("")),
});

const deleteSchema = z.object({
  reason: z.string().max(500).optional(),
});

async function loadEditableOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { error: NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 }) };
  }
  if (order.paymentStatus !== "PENDING") {
    return {
      error: NextResponse.json(
        { error: "ویرایش اقلام فقط برای سفارش‌های در انتظار تأیید ادمین مجاز است" },
        { status: 400 }
      ),
    };
  }
  return { order };
}

// ویرایش تعداد/قیمت یه قلم موجود -- فقط تا وقتی سفارش منتظر تأیید ادمینه
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id, itemId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const { error } = await loadEditableOrder(id);
  if (error) return error;

  const item = await prisma.orderItem.findUnique({ where: { id: itemId } });
  if (!item || item.orderId !== id) {
    return NextResponse.json({ error: "قلم سفارش یافت نشد" }, { status: 404 });
  }

  // «لینک اصلی ۲» کاملاً داخلی/فقط-ادمینه -- اگه فقط همین یکی عوض شده باشه
  // (تعداد/قیمت دست‌نخورده مونده)، نباید مشتری هیچ اطلاعی از این ویرایش پیدا
  // کنه (نه نوتیف، نه ردیف تاریخچه‌ی «منتظر تأیید شما»)
  const itemActuallyChanged = parsed.data.quantity !== item.quantity || parsed.data.price !== item.price;

  try {
    await prisma.$transaction(async (tx) => {
      if (item.source === "MAZON" && item.variantId) {
        await adjustVariantStockForQuantityChange(tx, item.variantId, parsed.data.quantity - item.quantity);
      }
      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          quantity: parsed.data.quantity,
          price: parsed.data.price,
          ...(parsed.data.secondarySourceUrl !== undefined
            ? { secondarySourceUrl: parsed.data.secondarySourceUrl || null }
            : {}),
        },
      });
      await recomputeOrderTotals(tx, id);
      if (itemActuallyChanged) {
        await markAwaitingCustomerReview(tx, id, parsed.data.reason);
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ویرایش قلم" },
      { status: 400 }
    );
  }

  const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  return NextResponse.json(updated);
}

// حذف کامل یه قلم -- موجودی variant (اگه مزون بود) کامل برمی‌گرده
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id, itemId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsedDelete = deleteSchema.safeParse(body);
  const { error } = await loadEditableOrder(id);
  if (error) return error;

  const item = await prisma.orderItem.findUnique({ where: { id: itemId } });
  if (!item || item.orderId !== id) {
    return NextResponse.json({ error: "قلم سفارش یافت نشد" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    if (item.source === "MAZON" && item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
    await tx.orderItem.delete({ where: { id: itemId } });
    await recomputeOrderTotals(tx, id);
    await markAwaitingCustomerReview(tx, id, parsedDelete.success ? parsedDelete.data.reason : undefined);
  });

  const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  return NextResponse.json(updated);
}

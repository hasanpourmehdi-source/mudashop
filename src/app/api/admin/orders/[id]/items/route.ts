import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { recomputeOrderTotals } from "@/lib/orderTotals";
import { markAwaitingCustomerReview } from "@/lib/orderNegotiation";
import { z } from "zod";

const mazonSchema = z.object({
  source: z.literal("MAZON"),
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  variantLabel: z.string().optional(),
});

const trendyolSchema = z.object({
  source: z.literal("TRENDYOL"),
  title: z.string().min(1),
  price: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  externalId: z.string().optional(),
  image: z.string().optional(),
  reason: z.string().max(500).optional(),
  variantLabel: z.string().optional(),
});

const schema = z.union([mazonSchema, trendyolSchema]);

// افزودن یه قلم جدید به سفارشی که هنوز منتظر تأیید ادمینه -- از صفحه‌ی خودِ
// محصول صدا زده می‌شه (نه یه فرم دستی)، پس برای مزون variantId واقعی (سایز/رنگ
// انتخاب‌شده) هم می‌رسه: قیمت نهایی و موجودی دقیقاً مثل لحظه‌ی ثبت سفارش از
// روی product+variant سرور-ساید محاسبه/کم می‌شه. برای ترندیول چون داده از
// همون صفحه‌ی زنده‌ی محصول اومده (نه تایپ دستی)، مستقیم پذیرفته می‌شه
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }
  if (order.paymentStatus !== "PENDING") {
    return NextResponse.json(
      { error: "ویرایش اقلام فقط برای سفارش‌های در انتظار تأیید ادمین مجاز است" },
      { status: 400 }
    );
  }

  let itemData: {
    source: "MAZON" | "TRENDYOL";
    productId?: string;
    variantId?: string;
    externalId?: string;
    title: string;
    image: string | null;
    price: number;
    quantity: number;
    variantLabel: string | null;
  };

  if (parsed.data.source === "MAZON") {
    const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
    if (!product) {
      return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });
    }
    const images = JSON.parse(product.images) as string[];
    let price = Math.round(product.basePrice * (1 - product.discount / 100));
    let variantId: string | undefined;

    if (parsed.data.variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { id: parsed.data.variantId } });
      if (!variant || variant.productId !== product.id) {
        return NextResponse.json({ error: "ترکیب انتخابی یافت نشد" }, { status: 404 });
      }
      if (variant.stock < parsed.data.quantity) {
        return NextResponse.json({ error: "موجودی کافی برای این تعداد وجود ندارد" }, { status: 400 });
      }
      price += variant.priceDiff;
      variantId = variant.id;
    }

    itemData = {
      source: "MAZON",
      productId: product.id,
      variantId,
      title: product.title,
      image: images[0] ?? null,
      price,
      quantity: parsed.data.quantity,
      variantLabel: parsed.data.variantLabel ?? null,
    };
  } else {
    itemData = {
      source: "TRENDYOL",
      externalId: parsed.data.externalId,
      title: parsed.data.title,
      image: parsed.data.image ?? null,
      price: parsed.data.price,
      quantity: parsed.data.quantity,
      variantLabel: parsed.data.variantLabel ?? null,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.create({ data: { orderId: id, ...itemData } });
    if (itemData.source === "MAZON" && itemData.variantId) {
      await tx.productVariant.update({
        where: { id: itemData.variantId },
        data: { stock: { decrement: itemData.quantity } },
      });
    }
    await recomputeOrderTotals(tx, id);
    await markAwaitingCustomerReview(tx, id, parsed.data.reason);
  });

  const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  return NextResponse.json(updated);
}

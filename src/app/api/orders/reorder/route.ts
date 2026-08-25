import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchActiveFlashSales } from "@/lib/products";
import { buildReorderCartItems } from "@/lib/reorder";
import { z } from "zod";

// «خرید مجدد سریع» -- اقلام مزونِ یک سفارش قبلی را با قیمت/موجودیِ فعلیِ
// محصول (نه snapshot قدیمی سفارش) به سبد برمی‌گرداند؛ اقلام ناموجود/غیرفعال
// رد می‌شوند و به مشتری گزارش داده می‌شوند. اقلام ترندیول با همون قیمت/عکسِ
// لحظه‌ی سفارشِ قبلی (بدون زنده‌سازی) اضافه می‌شن.
const bodySchema = z.object({ orderId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "سفارش نامعتبر است" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { items: true },
  });
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  const mazonItems = order.items.filter((i) => i.source === "MAZON" && i.productId);
  // اقلام ترندیول همون قیمت/عکس/عنوان لحظه‌ی خریدِ قبلی رو دارن (بدون
  // به‌روزرسانی زنده) -- دقیقاً مثل خودِ سفارش که موقع ثبت با همون قیمت
  // قفل شده بود؛ درست‌بودنش (موجودی/قیمت لحظه‌ای) هر چیه، بعداً موقع خریدِ
  // واقعی توسط ادمین دوباره چک می‌شه، همون‌طور که برای هر سفارش خارجیِ دیگه
  const trendyolItems = order.items.filter((i) => i.source === "TRENDYOL" && i.externalId);
  if (mazonItems.length === 0 && trendyolItems.length === 0) {
    return NextResponse.json(
      { error: "این سفارش محصول قابل‌خرید مجدد ندارد" },
      { status: 400 }
    );
  }

  const productIds = Array.from(new Set(mazonItems.map((i) => i.productId!)));
  const variantIds = Array.from(
    new Set(mazonItems.map((i) => i.variantId).filter((v): v is string => !!v))
  );

  const [products, variants, activeFlashSales] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true,
        title: true,
        slug: true,
        basePrice: true,
        discount: true,
        fastShipping: true,
        images: true,
      },
    }),
    prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { values: true },
    }),
    fetchActiveFlashSales(),
  ]);

  const result = buildReorderCartItems({
    items: mazonItems,
    products,
    variants,
    flashSales: activeFlashSales,
  });

  const trendyolCartItems = trendyolItems.map((i) => ({
    id: i.externalId!,
    source: "TRENDYOL" as const,
    productId: i.externalId!,
    title: i.title,
    image: i.image ?? "",
    price: i.price,
    quantity: i.quantity,
  }));

  return NextResponse.json({
    cartItems: [...result.cartItems, ...trendyolCartItems],
    skipped: result.skipped,
  });
}
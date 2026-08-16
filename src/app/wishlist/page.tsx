import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchActiveFlashSales, normalizeMazonProduct } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import type { UnifiedProduct } from "@/types/product";

export default async function WishlistPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const [mazonItems, trendyolItems, activeFlashSales] = await Promise.all([
    prisma.wishlistItem.findMany({
      where: { userId: session.user.id, source: "MAZON" },
      orderBy: { createdAt: "desc" },
      select: {
        productId: true,
        createdAt: true,
        product: { include: { category: true, brand: true } },
      },
    }),
    // محصولات ترندیول -- چون جدول محلی برای join نداریم، مستقیم از
    // snapshot ذخیره‌شده در لحظه‌ی افزودن استفاده می‌کنیم (نه یه fetch زنده‌ی
    // جدید برای هرکدوم، که هم کند می‌شد هم فشار زیادی روی ترندیول می‌ذاشت)
    prisma.wishlistItem.findMany({
      where: { userId: session.user.id, source: "TRENDYOL" },
      orderBy: { createdAt: "desc" },
    }),
    fetchActiveFlashSales(),
  ]);

  const flashByProductId = new Map(activeFlashSales.map((f) => [f.productId, f]));

  const mazonProducts = mazonItems
    .filter((w) => w.product) // اگه محصولی از قبل حذف شده باشه، product می‌تونه null باشه
    .map((w) => ({
      product: normalizeMazonProduct(w.product!, flashByProductId.get(w.productId!)),
      addedAt: w.createdAt,
    }));

  const trendyolProducts = trendyolItems.map((w) => ({
    product: {
      id: `trendyol-${w.externalId}`,
      source: "TRENDYOL" as const,
      slugOrId: w.externalId ?? "",
      title: w.externalTitle ?? "محصول ترندیول",
      price: w.externalPrice ?? 0,
      originalPrice: w.externalPrice ?? 0,
      discount: 0,
      image: w.externalImage ?? "",
      images: w.externalImage ? [w.externalImage] : [],
      createdAt: w.createdAt.toISOString(),
      sourceUrl: w.externalUrl ?? undefined,
    } satisfies UnifiedProduct,
    addedAt: w.createdAt,
  }));

  // ترکیب هر دو منبع، مرتب‌شده بر اساس زمان *افزودن به علاقه‌مندی* (نه تاریخ
  // ساخت خودِ محصول) -- تا جدیدترین موردی که کاربر اضافه کرده همیشه بالای لیست باشه
  const items = [...mazonProducts, ...trendyolProducts].sort(
    (a, b) => b.addedAt.getTime() - a.addedAt.getTime()
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">علاقه‌مندی‌های من</h1>

      {items.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-muted)]">
          <p className="mb-4">هنوز محصولی به علاقه‌مندی‌هات اضافه نکردی.</p>
          <Link
            href="/products"
            className="inline-block bg-[var(--color-wine)] text-white px-5 py-2.5 rounded-full text-sm font-medium"
          >
            مشاهده محصولات
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map(({ product }) => (
            <ProductCard key={product.id} product={product} isWishlisted />
          ))}
        </div>
      )}
    </div>
  );
}

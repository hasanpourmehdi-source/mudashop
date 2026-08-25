import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchActiveFlashSales, parseImages } from "@/lib/products";
import { fetchActiveCampaigns } from "@/lib/campaigns";
import { rankByRelevance } from "@/lib/fuzzySearch";

const MAX_PRODUCTS = 6;
const MAX_CATEGORIES = 3;
const MAX_BRANDS = 3;
const MAX_CAMPAIGNS = 2;

// این پیشنهادهای زنده (dropdown) فقط روی کاتالوگ واقعیِ مزون کار می‌کنن -- نه
// چیزی مثل fetchAllProducts که قبلاً داده‌ی نمایشیِ fakestoreapi رو هم به‌عنوان
// «ترندیول» قاطی نتایج واقعی می‌کرد. جست‌وجوی زنده‌ی خودِ ترندیول (که واقعاً به
// trendyol.com می‌زنه) عمداً فقط با Enter توی صفحه‌ی هر مارکت‌پلیس اتفاق می‌افته
// (نه هر کلیدی که تایپ می‌شه) تا درخواست زیادی به سایت اصلی نزنیم
//
// خروجی گروه‌بندی‌شده (دسته‌بندی/برند/کمپین/محصول) -- شبیه دراپ‌داون خودِ
// ترندیول: هر گروه از بین همه‌ی ردیف‌های همون جدول (که تعدادشون کمه، پس واکشیِ
// کامل + رتبه‌بندی توی جاوااسکریپت مشکلی نداره) با scoreRelevance فیلتر و
// مرتب می‌شه، تا هم دسته‌بندی/برند/کمپین غلط‌تایپی‌دار هم پیدا بشه
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ categories: [], brands: [], campaigns: [], products: [] });
  }

  const [categoriesAll, brandsAll, campaignsAll, products, activeFlashSales] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, slug: true, icon: true, imageUrl: true } }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
    fetchActiveCampaigns(),
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        title: true,
        images: true,
        basePrice: true,
        discount: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    fetchActiveFlashSales(),
  ]);

  const categories = rankByRelevance(categoriesAll, q, (c) => [{ text: c.name, weight: 1 }])
    .slice(0, MAX_CATEGORIES)
    .map(({ item: c }) => ({
      id: c.id,
      title: c.name,
      icon: c.icon ?? null,
      image: c.imageUrl ?? null,
      href: `/products?categories=${encodeURIComponent(c.slug)}`,
    }));

  const brands = rankByRelevance(brandsAll, q, (b) => [{ text: b.name, weight: 1 }])
    .slice(0, MAX_BRANDS)
    .map(({ item: b }) => ({
      id: b.id,
      title: b.name,
      href: `/products?brands=${encodeURIComponent(b.name)}`,
    }));

  // ترکیب یه کمپین رو هم عنوانش هم اسم برندش قابل جست‌وجوست ("حراج تابستانه"
  // یا مستقیم "پارسیان‌پوش") -- چون هنوز صفحه‌ی جزئیات مستقلی برای کمپین‌ها
  // نداریم، دقیقاً مثل بنر صفحه‌ی اصلی به لیست محصولات همون برند لینک می‌دیم
  const campaigns = rankByRelevance(campaignsAll, q, (c) => [
    { text: c.title, weight: 1 },
    { text: c.brand.name, weight: 0.6 },
  ])
    .slice(0, MAX_CAMPAIGNS)
    .map(({ item: c }) => ({
      id: c.id,
      title: c.title,
      image: c.bannerImage,
      href: `/products?brands=${encodeURIComponent(c.brand.name)}`,
    }));

  const flashByProductId = new Map(activeFlashSales.map((f) => [f.productId, f]));

  // عنوان مهم‌ترینه، بعد برند، بعد دسته‌بندی -- یه محصول که کلمه‌ی جست‌وجو
  // دقیقاً توی عنوانشه همیشه باید از یکی که فقط دسته‌بندیش مچ شده جلوتر بیاد
  const rankedProducts = rankByRelevance(products, q, (p) => [
    { text: p.title, weight: 3 },
    { text: p.brand?.name, weight: 2 },
    { text: p.category?.name, weight: 1 },
  ]).slice(0, MAX_PRODUCTS);

  const productResults = rankedProducts.map(({ item: p }) => {
    const flashSale = flashByProductId.get(p.id);
    const effectiveDiscount = flashSale ? flashSale.discountPercent : p.discount;
    const price = Math.round(p.basePrice * (1 - effectiveDiscount / 100));
    return {
      id: p.id,
      title: p.title,
      image: parseImages(p.images)[0] ?? "",
      price,
      href: `/products/mazon/${p.slug}`,
    };
  });

  return NextResponse.json({
    categories,
    brands,
    campaigns,
    products: productResults,
  });
}

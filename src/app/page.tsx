import Link from "next/link";
import { fetchMazonProducts, fetchPopularityMap, pickAdvantageousProducts } from "@/lib/products";
import { fetchPopularPhotoReviews } from "@/lib/reviews";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fetchWishlistedProductIds } from "@/lib/wishlist";
import { fetchActiveCampaigns } from "@/lib/campaigns";
import { fetchPersonalCategories } from "@/lib/categories";
import { PersonalCategoriesShowcase } from "@/components/PersonalCategoriesShowcase";
import { DiscoverableProductsSection } from "@/components/DiscoverableProductsSection";
import { ProductCard } from "@/components/ProductCard";
import { FlashSaleCountdownBoxes } from "@/components/FlashSaleCountdownBoxes";
import { DiscountTierBanners } from "@/components/DiscountTierBanners";
import { CategoryDiscountShowcase } from "@/components/CategoryDiscountShowcase";
import { PhotoReviewsShowcase } from "@/components/PhotoReviewsShowcase";

export default async function Home() {
  const session = await auth();
  const [products, categories, stockGroups, wishlistedIds, campaigns, popularity, photoReviews, personalCategories] =
    await Promise.all([
      fetchMazonProducts(),
      prisma.category.findMany({ orderBy: { name: "asc" }, take: 8 }),
      prisma.productVariant.groupBy({
        by: ["productId"],
        _sum: { stock: true },
      }),
      fetchWishlistedProductIds(session?.user?.id),
      fetchActiveCampaigns(),
      fetchPopularityMap(),
      fetchPopularPhotoReviews(),
      fetchPersonalCategories(session?.user?.id),
    ]);

  // پرفروش‌ترین‌ها -- بر اساس تعداد واقعی خرید هر محصول (نه تصادفی)
  const popularProducts = [...products]
    .sort((a, b) => (popularity[b.id] ?? 0) - (popularity[a.id] ?? 0))
    .slice(0, 10);

  // پربازدیدترین‌ها -- بر اساس بازدید ۲۴ ساعت گذشته (مستقل از پرفروش‌بودن)
  const mostViewedProducts = [...products]
    .filter((p) => (p.viewCount24h ?? 0) > 0)
    .sort((a, b) => (b.viewCount24h ?? 0) - (a.viewCount24h ?? 0))
    .slice(0, 10);

  // محصولات مزیت‌دار -- ترکیبی از امتیاز بالا، کمترین قیمت ۱۰ روز، تخفیف، و پسندیدن زیاد
  const advantageousProducts = pickAdvantageousProducts(products);

  // مجموع موجودی هر محصول (از روی وارینت‌ها) — برای اولویت‌دهی به فروش موجودی انبار
  const stockByProduct = new Map(stockGroups.map((g) => [g.productId, g._sum.stock ?? 0]));

  // محصولاتی که موجودی بیشتری دارن اول نمایش داده می‌شن تا زودتر به فروش برسن
  const featured = [...products]
    .sort((a, b) => (stockByProduct.get(b.id) ?? 0) - (stockByProduct.get(a.id) ?? 0))
    .slice(0, 8);
  const flashProducts = products.filter((p) => p.flashSale);

  return (
    <div>
      {/* میان‌برهای سریع -- مثل ردیف آیکونی ترندیول، ولی فقط با قابلیت‌های واقعی خودمون */}
      <section className="border-b cut-line">
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          <div className="flex gap-6 overflow-x-auto">
            {[
              { href: "/products?flashSaleOnly=true", icon: "⚡", label: "حراج فلش", bg: "#fff1e0" },
              { href: "/products?fastShipping=true", icon: "🚚", label: "ارسال فوری", bg: "#e6f7ef" },
              { href: "/products?sources=MAZON", icon: "✦", label: "محصولات مزون", bg: "#fdeaf1" },
              { href: "/products?sources=TRENDYOL", icon: "🛍️", label: "ترندیول", bg: "#eaf1fd" },
              { href: "/products?sort=popular", icon: "🔥", label: "پرفروش‌ترین‌ها", bg: "#fdeaea" },
              { href: "/products?sort=newest", icon: "🆕", label: "جدیدترین‌ها", bg: "#f1eafd" },
              { href: "/wallet", icon: "💰", label: "کیف پول", bg: "#fdf6ea" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center gap-2 shrink-0 w-20 group"
              >
                <span
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border cut-line group-hover:border-[var(--color-wine)] transition-colors"
                  style={{ background: item.bg }}
                >
                  {item.icon}
                </span>
                <span className="text-xs text-center font-medium leading-tight">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* پرفروش‌ترین‌ها */}
      {popularProducts.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">پرفروش‌ترین‌ها</h2>
            <Link
              href="/products?sort=popular"
              className="text-sm font-medium text-[var(--color-wine)] hover:underline flex items-center gap-1"
            >
              مشاهده همه ‹
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
            {popularProducts.map((p) => (
              <div key={p.id} className="w-44 sm:w-52 shrink-0">
                <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* پربازدیدترین‌ها */}
      {mostViewedProducts.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">پربازدیدترین‌ها</h2>
            <Link
              href="/products?sort=most_viewed"
              className="text-sm font-medium text-[var(--color-wine)] hover:underline flex items-center gap-1"
            >
              مشاهده همه ‹
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
            {mostViewedProducts.map((p) => (
              <div key={p.id} className="w-44 sm:w-52 shrink-0">
                <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* دسته‌بندی‌های ویژه‌ی شما -- بر اساس ویشلیست و تاریخچه‌ی خرید */}
      <PersonalCategoriesShowcase categories={personalCategories} />

      {/* محصولات قابل کشف -- تب‌های فلش/تخفیف‌دار/پرفروش/جدیدترین/ارسال فوری */}
      <DiscoverableProductsSection
        products={products}
        popularity={popularity}
        wishlistedIds={Array.from(wishlistedIds)}
      />

      {/* محصولات مزیت‌دار -- ترکیبی از حداقل ۲ سیگنال واقعی (امتیاز بالا، کمترین قیمت ۱۰ روز، تخفیف، پسندیدن زیاد) */}
      {advantageousProducts.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
          <h2 className="text-xl font-bold mb-1">محصولات مزیت‌دار</h2>
          <p className="text-xs text-[var(--color-muted)] mb-6">
            انتخاب‌شده بر اساس امتیاز بالا، کمترین قیمت ۱۰ روز اخیر، تخفیف و میزان پسندیدن
          </p>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
            {advantageousProducts.map((p) => (
              <div key={p.id} className="w-44 sm:w-52 shrink-0">
                <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* کشف بر اساس درصد تخفیف -- فقط مزون */}
      <DiscountTierBanners products={products} />

      {/* کشف تخفیف‌ها بر اساس دسته‌بندی -- فقط مزون */}
      <CategoryDiscountShowcase categories={categories} products={products} />

      {/* حراج فلش -- بنر گرادیانی با شمارش معکوس و «مشاهده همه» بالای ردیف محصولات */}
      {flashProducts.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-4 py-8">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "linear-gradient(90deg, #d9670f, #f27a1a, #ef4477)" }}
          >
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-2 text-white font-extrabold text-lg shrink-0">
                  <span aria-hidden>⚡</span> حراج فلش
                </span>
                <FlashSaleCountdownBoxes
                  endsAt={
                    flashProducts
                      .map((p) => p.flashSale!.endsAt)
                      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
                  }
                />
              </div>
              <Link
                href="/products?flashSaleOnly=true"
                className="text-white text-sm font-bold flex items-center gap-1 shrink-0 hover:underline"
              >
                مشاهده همه ‹
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-5 pb-5">
              {flashProducts.map((p) => (
                <div key={p.id} className="w-44 sm:w-52 shrink-0">
                  <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* کمپین برندها */}
      {campaigns.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
          <h2 className="text-xl font-bold mb-6">کمپین‌های ویژه</h2>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/products?brands=${encodeURIComponent(c.brand.name)}`}
                className="shrink-0 w-[420px] rounded-2xl overflow-hidden border cut-line bg-white hover:border-[var(--color-wine)] transition-colors"
              >
                <div className="relative w-full aspect-[2/1] bg-[var(--color-linen-dim)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.bannerImage} alt={c.title} className="w-full h-full object-cover" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* نظرات عکس‌دار محبوب */}
      <PhotoReviewsShowcase reviews={photoReviews} />

      {/* محصولات ویژه */}
      <section className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">پیشنهاد امروز</h2>
          <Link href="/products?sources=MAZON" className="text-sm text-[var(--color-wine)] font-medium">
            مشاهده همه ←
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className="text-[var(--color-muted)] text-sm">
            هنوز محصولی ثبت نشده — از پنل ادمین محصول اضافه کنید.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* راهنمای ترندیول — صفحه اصلی فقط مزونه، ولی راه رو نشون می‌دیم */}
      <section className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="rounded-2xl border-2 cut-line bg-[var(--color-linen-dim)] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold mb-1">دنبال تنوع بیشتری هستید؟</h3>
            <p className="text-sm text-[var(--color-muted)] max-w-md">
              علاوه بر محصولات مزون، می‌تونید توی کاتالوگ ترندیول هم جستجو کنید و
              همون‌جا سفارش آنلاین بدید.
            </p>
          </div>
          <Link
            href="/products?sources=TRENDYOL"
            className="shrink-0 inline-block border-2 cut-line rounded-full px-6 py-3 font-medium bg-white hover:border-[var(--color-wine)] transition-colors"
          >
            جستجو در ترندیول ←
          </Link>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { fetchMazonProducts, fetchPopularityMap, pickAdvantageousProducts } from "@/lib/products";
import { fetchPopularPhotoReviews } from "@/lib/reviews";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fetchWishlistedProductIds } from "@/lib/wishlist";
import { fetchActiveCampaigns } from "@/lib/campaigns";
import { fetchActiveOccasionCollections } from "@/lib/occasionCollections";
import { OccasionCollectionShowcase } from "@/components/OccasionCollectionShowcase";
import { fetchDiscoveredCampaignsForHomepage } from "@/lib/trendyolCampaigns";
import { TrendyolCampaignsShowcase } from "@/components/TrendyolCampaignsShowcase";
import { fetchPersonalCategories } from "@/lib/categories";
import { PersonalCategoriesShowcase } from "@/components/PersonalCategoriesShowcase";
import { DiscoverableProductsSection } from "@/components/DiscoverableProductsSection";
import { ProductCard } from "@/components/ProductCard";
import { FlashSaleCountdownBoxes } from "@/components/FlashSaleCountdownBoxes";
import { DiscountTierBanners } from "@/components/DiscountTierBanners";
import { CategoryDiscountShowcase } from "@/components/CategoryDiscountShowcase";
import { PhotoReviewsShowcase } from "@/components/PhotoReviewsShowcase";
import { RecentlyViewedSection } from "@/components/RecentlyViewedSection";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import { fetchRecommendedForYou } from "@/lib/recommend";
import { fetchVideoWallItems } from "@/lib/videoWall";
import { VideoWallSection } from "@/components/VideoWallSection";
import { fetchTrendyolTopDiscounts } from "@/lib/trendyolTopDiscounts";
import { fetchTrendyolDailyPriceDrops } from "@/lib/trendyolDailyPriceDrops";
import { fetchTrendyolBestSelling } from "@/lib/trendyolBestSelling";
import { TrendyolTopDiscountsSection } from "@/components/TrendyolTopDiscountsSection";
import { getFeatureFlags } from "@/lib/featureFlags";
import { getSiteSetting, SITE_SETTING_KEYS, fetchTrustBadges } from "@/lib/siteSettings";

export default async function Home() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const flags = await getFeatureFlags();
  const minDiscountPercentToShow =
    Number(await getSiteSetting(SITE_SETTING_KEYS.MIN_DISCOUNT_PERCENT_TO_SHOW)) || 2;
  const [
    products,
    categories,
    stockGroups,
    wishlistedIds,
    campaigns,
    occasionCollections,
    trendyolCampaigns,
    popularity,
    photoReviews,
    personalCategories,
    recommended,
    videoWallItems,
    trendyolTopDiscounts,
    trendyolDailyPriceDrops,
    trendyolBestSelling,
    activeExternalSites,
    trustBadges,
  ] = await Promise.all([
    fetchMazonProducts(),
    prisma.category.findMany({ orderBy: { name: "asc" }, take: 8 }),
    prisma.productVariant.groupBy({
      by: ["productId"],
      _sum: { stock: true },
    }),
    fetchWishlistedProductIds(session?.user?.id),
    flags[SITE_SETTING_KEYS.FEATURE_BRAND_CAMPAIGNS] ? fetchActiveCampaigns() : Promise.resolve([]),
    flags[SITE_SETTING_KEYS.FEATURE_OCCASION_COLLECTIONS]
      ? fetchActiveOccasionCollections()
      : Promise.resolve([]),
    flags[SITE_SETTING_KEYS.FEATURE_TRENDYOL_CAMPAIGNS]
      ? fetchDiscoveredCampaignsForHomepage()
      : Promise.resolve([]),
    fetchPopularityMap(),
    flags[SITE_SETTING_KEYS.FEATURE_PHOTO_REVIEWS] ? fetchPopularPhotoReviews() : Promise.resolve([]),
    flags[SITE_SETTING_KEYS.FEATURE_PERSONAL_CATEGORIES]
      ? fetchPersonalCategories(session?.user?.id)
      : Promise.resolve([]),
    flags[SITE_SETTING_KEYS.FEATURE_RECOMMENDED]
      ? fetchRecommendedForYou(session?.user?.id, 10)
      : Promise.resolve([]),
    flags[SITE_SETTING_KEYS.FEATURE_VIDEO_WALL] ? fetchVideoWallItems() : Promise.resolve([]),
    flags[SITE_SETTING_KEYS.FEATURE_TRENDYOL_TOP_DISCOUNTS]
      ? fetchTrendyolTopDiscounts("trendyol")
      : Promise.resolve([]),
    flags[SITE_SETTING_KEYS.FEATURE_TRENDYOL_PRICE_DROPS]
      ? fetchTrendyolDailyPriceDrops("trendyol")
      : Promise.resolve([]),
    flags[SITE_SETTING_KEYS.FEATURE_TRENDYOL_BEST_SELLING]
      ? fetchTrendyolBestSelling("trendyol")
      : Promise.resolve([]),
    prisma.externalSite.findMany({ where: { isActive: true }, select: { slug: true } }),
    fetchTrustBadges(),
  ]);

  // اگه ادمین هیچ سایتِ خارجی‌ای تعریف/فعال نکرده باشه (حالتِ «فقط مزون»)،
  // میان‌برها/بنرِ راهنمای ترندیول/میلا نباید نشون داده بشن -- وگرنه لینکِ
  // مرده به یه صفحه‌ای می‌شن که ۴۰۴ می‌ده
  const activeExternalSlugs = new Set(activeExternalSites.map((s) => s.slug));
  const hasTrendyol = activeExternalSlugs.has("trendyol");
  const hasMilla = activeExternalSlugs.has("trendyol-milla");
  const hasAnyExternalSite = activeExternalSlugs.size > 0;

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
      {/* نوارِ اعتماد -- طبقِ نظرِ خودم که مهدی خواست انجامش بدم: بج‌های اعتماد
          قبلاً فقط پراکنده بودن (فوتر، صفحه‌ی محصول، چک‌اوت)، هیچ جای متمرکز و
          برجسته‌ای نبود. همین دیتای از قبل‌موجود، فقط این‌بار بزرگ‌تر و بالای
          صفحه‌ی اصلی -- اولین چیزی که بازدیدکننده می‌بینه */}
      {trustBadges.length > 0 && (
        <section className="bg-white border-b cut-line">
          <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {trustBadges.map((b, i) => (
              <span key={i} className="flex items-center gap-2 text-sm font-medium">
                <span className="text-xl leading-none">{b.icon}</span>
                {b.text}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* میان‌برهای سریع -- مثل ردیف آیکونی ترندیول، ولی فقط با قابلیت‌های واقعی خودمون */}
      <section className="border-b cut-line">
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          <HorizontalScroller className="px-4 -mx-4">
            {[
              { href: "/products?flashSaleOnly=true", icon: "⚡", label: "حراج فلش", bg: "#fff1e0" },
              { href: "/products?fastShipping=true", icon: "🚚", label: "ارسال فوری", bg: "#e6f7ef" },
              // «سایت‌ها» (sources) اصلاً پارامترِ شناخته‌شده‌ی صفحه‌ی /products
              // نبود -- چون آن صفحه فقط کاتالوگِ مزون است؛ محصولاتِ ترندیول/میلا
              // اصلاً توی جدولِ محصولاتِ ما نیستن، پس لینکِ درست همون صفحه‌ی
              // زنده‌ی خودشونه (/marketplaces/...)، نه فیلترِ بی‌اثر روی /products
              { href: "/products", icon: "✦", label: "محصولات مزون", bg: "#fdeaf1" },
              ...(hasTrendyol
                ? [{ href: "/marketplaces/trendyol", icon: "🛍️", label: "ترندیول", bg: "#eaf1fd" }]
                : []),
              ...(hasMilla
                ? [{ href: "/marketplaces/trendyol-milla", icon: "👗", label: "میلا", bg: "#f5eaff" }]
                : []),
              { href: "/campaigns", icon: "🏷️", label: "کمپین‌ها", bg: "#fff4e0" },
              { href: "/products?sort=popular", icon: "🔥", label: "پرفروش‌ترین‌ها", bg: "#fdeaea" },
              { href: "/products?sort=newest", icon: "🆕", label: "جدیدترین‌ها", bg: "#f1eafd" },
              ...(flags[SITE_SETTING_KEYS.FEATURE_DEFECTIVE_ITEMS]
                ? [{ href: "/products?defectiveOnly=true", icon: "⚠️", label: "ایراد دار", bg: "#fdf3e0" }]
                : []),
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
          </HorizontalScroller>
        </div>
      </section>

      {/* اخیراً دیدهاید -- سمت کلاینت از localStorage، پس فقط بعد از mount ظاهر می‌شه */}
      {flags[SITE_SETTING_KEYS.FEATURE_RECENTLY_VIEWED] && <RecentlyViewedSection />}

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
          <HorizontalScroller>
            {popularProducts.map((p) => (
              <div key={p.id} className="w-44 sm:w-52 shrink-0">
                <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
              </div>
            ))}
          </HorizontalScroller>
        </section>
      )}

      {/* پیشنهاد برای تو -- توصیه‌گر: بر اساس تعاملات خودت (خرید/ویشلیست/نظر/اخطار قیمت)
          و رفتارِ کاربران مشابه؛ برای کاربرِ جدید محبوب‌ترین‌ها پیشنهاد می‌شود */}
      {flags[SITE_SETTING_KEYS.FEATURE_RECOMMENDED] && recommended.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {session?.user ? "✨ پیشنهاد برای تو" : "✨ پرطرفدار این روزها"}
            </h2>
            {!session?.user && (
              <p className="text-xs text-[var(--color-muted)]">بر اساس رفتارِ کاربران، چون هنوز ورود نکرده‌ای</p>
            )}
          </div>
          <HorizontalScroller>
            {recommended.map((p) => (
              <div key={p.id} className="w-44 sm:w-52 shrink-0">
                <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
              </div>
            ))}
          </HorizontalScroller>
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
          <HorizontalScroller>
            {mostViewedProducts.map((p) => (
              <div key={p.id} className="w-44 sm:w-52 shrink-0">
                <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
              </div>
            ))}
          </HorizontalScroller>
        </section>
      )}

      {/* دسته‌بندی‌های ویژه‌ی شما -- بر اساس ویشلیست و تاریخچه‌ی خرید */}
      {flags[SITE_SETTING_KEYS.FEATURE_PERSONAL_CATEGORIES] && (
        <PersonalCategoriesShowcase categories={personalCategories} />
      )}

      {/* محصولات قابل کشف -- تب‌های فلش/تخفیف‌دار/پرفروش/جدیدترین/ارسال فوری */}
      {flags[SITE_SETTING_KEYS.FEATURE_DISCOVERABLE_TABS] && (
        <DiscoverableProductsSection
          products={products}
          popularity={popularity}
          wishlistedIds={Array.from(wishlistedIds)}
        />
      )}

      {/* محصولات مزیت‌دار -- ترکیبی از حداقل ۲ سیگنال واقعی (امتیاز بالا، کمترین قیمت ۱۰ روز، تخفیف، پسندیدن زیاد) */}
      {advantageousProducts.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
          <h2
            className="text-xl font-bold mb-6 w-fit"
            title="انتخاب‌شده بر اساس امتیاز بالا، کمترین قیمت ۱۰ روز اخیر، تخفیف و میزان پسندیدن"
          >
            محصولات باارزش
          </h2>
          <HorizontalScroller>
            {advantageousProducts.map((p) => (
              <div key={p.id} className="w-44 sm:w-52 shrink-0">
                <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
              </div>
            ))}
          </HorizontalScroller>
        </section>
      )}

      {flags[SITE_SETTING_KEYS.FEATURE_DISCOUNT_DISCOVERY] && (
        <>
          {/* کشف بر اساس درصد تخفیف -- فقط مزون */}
          <DiscountTierBanners products={products} />

          {/* کشف تخفیف‌ها بر اساس دسته‌بندی -- فقط مزون */}
          <CategoryDiscountShowcase categories={categories} products={products} />
        </>
      )}

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
            <HorizontalScroller className="px-4 sm:px-5 -mx-0 pb-5">
              {flashProducts.map((p) => (
                <div key={p.id} className="w-44 sm:w-52 shrink-0">
                  <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
                </div>
              ))}
            </HorizontalScroller>
          </div>
        </section>
      )}

      {/* کمپین برندها */}
      {flags[SITE_SETTING_KEYS.FEATURE_BRAND_CAMPAIGNS] && campaigns.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
          <h2 className="text-xl font-bold mb-6">کمپین‌های ویژه</h2>
          <HorizontalScroller>
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
          </HorizontalScroller>
        </section>
      )}

      {/* مجموعه‌های مناسبتی -- کالکشنِ زمان‌دارِ ادمین‌ساخته از هر برند/دسته‌ای */}
      {flags[SITE_SETTING_KEYS.FEATURE_OCCASION_COLLECTIONS] && (
        <OccasionCollectionShowcase collections={occasionCollections} />
      )}

      {/* کمپین‌های واقعیِ ترندیول -- کشف‌شده به‌مرور از محصولاتی که روی خودِ
          سایت دیده شده‌اند (نه یک کرالِ کامل)، برای این‌که کاربر بدون باز کردنِ
          اول یک محصولِ خاص، مستقیم وارد لیستِ کاملِ محصولاتِ یک کمپین شود */}
      {flags[SITE_SETTING_KEYS.FEATURE_TRENDYOL_CAMPAIGNS] && (
        <TrendyolCampaignsShowcase campaigns={trendyolCampaigns} isAdmin={isAdmin} />
      )}

      {flags[SITE_SETTING_KEYS.FEATURE_TRENDYOL_TOP_DISCOUNTS] && (
        <TrendyolTopDiscountsSection
          products={trendyolTopDiscounts}
          title="🔥 پرتخفیف‌ترین‌های ترندیول"
          minDiscountPercentToShow={minDiscountPercentToShow}
        />
      )}

      {/* دقیقاً همون فیدِ «Bugün Fiyatı Düşenler»ِ خودِ ترندیول -- محصولاتی که
          قیمتشون تازه افت کرده، سراسریِ همه‌ی دسته‌بندی‌ها (نه محدود به یه دسته) */}
      {flags[SITE_SETTING_KEYS.FEATURE_TRENDYOL_PRICE_DROPS] && (
        <TrendyolTopDiscountsSection
          products={trendyolDailyPriceDrops}
          title="⬇️ تخفیف‌های جدید"
          minDiscountPercentToShow={minDiscountPercentToShow}
        />
      )}

      {/* معادلِ «Sen De Al!»ِ خودِ ترندیول -- واکشی‌اش از قبل انجام می‌شد ولی رندرش جا افتاده بود */}
      {flags[SITE_SETTING_KEYS.FEATURE_TRENDYOL_BEST_SELLING] && (
        <TrendyolTopDiscountsSection
          products={trendyolBestSelling}
          title="🛍️ چون خیلی‌ها خریدن، تو هم بخر!"
          minDiscountPercentToShow={minDiscountPercentToShow}
        />
      )}

      {/* نظرات عکس‌دار محبوب */}
      {flags[SITE_SETTING_KEYS.FEATURE_PHOTO_REVIEWS] && <PhotoReviewsShowcase reviews={photoReviews} />}
      {flags[SITE_SETTING_KEYS.FEATURE_VIDEO_WALL] && <VideoWallSection items={videoWallItems} />}

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

      {/* راهنمای ترندیول — صفحه اصلی فقط مزونه، ولی راه رو نشون می‌دیم. اگه هیچ
          سایتِ خارجیِ فعالی نباشه (حالتِ «فقط مزون»)، این بنر اصلاً نشون داده
          نمی‌شه -- وگرنه به یه جست‌وجوی همیشه‌خالی لینک می‌داد */}
      {hasAnyExternalSite && (
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
      )}
    </div>
  );
}

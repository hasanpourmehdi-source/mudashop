import { notFound } from "next/navigation";
import {
  fetchMazonProductBySlug,
  fetchFrequentlyBoughtTogether,
  fetchCategoryBreadcrumb,
  fetchProductRatingSummary,
  fetchProductPurchaseCount,
  fetchProductQuestionCount,
  fetchSizeGuideImage,
  productDisplayCode,
  recordProductView,
  recordPriceSnapshotIfNeeded,
  fetchViewCount24h,
  fetchIsLowestPrice10d,
  fetchPriceHistory,
  fetchShowcasedCoupons,
} from "@/lib/products";import { advanceExpiredReservationQueues } from "@/lib/stockNotify";
import { checkPriceAlerts } from "@/lib/priceAlert";
import { auth } from "@/lib/auth";
import { fetchFixedAttributesForCategory } from "@/lib/facets";
import { fetchWishlistedProductIds } from "@/lib/wishlist";
import { parseAttrsQuery } from "@/lib/attrsQuery";
import { AddToCartForm } from "@/components/AddToCartForm";
import { CountdownTimer } from "@/components/CountdownTimer";
import { ReviewsSection } from "@/components/ReviewsSection";
import { QASection } from "@/components/QASection";
import { ProductGallery } from "@/components/ProductGallery";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ColorSyncProvider } from "@/components/ColorSyncProvider";
import { HorizontalProductCarousel } from "@/components/HorizontalProductCarousel";
import { RecentlyViewedRecorder } from "@/components/RecentlyViewedRecorder";
import { CompareToggleButton } from "@/components/CompareToggleButton";
import { PriceAlertWidget } from "@/components/PriceAlertWidget";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { getSiteSetting, getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { fetchRelatedProducts } from "@/lib/recommend";
import { ProductJsonLd } from "@/components/ProductJsonLd";
import { toMetaDescription, priceFa, siteUrl } from "@/lib/seo";
import type { Metadata } from "next";

// متادیتای سئو صفحه‌ی محصول مزون -- عنوان، توضیح، تصویر OG و canonical
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchMazonProductBySlug(slug);
  if (!product) return {};

  const description = toMetaDescription(product.description);
  const url = siteUrl(`/products/mazon/${product.slugOrId}`);

  return {
    title: product.title,
    description: description || `خرید ${product.title} — ${priceFa(product.price)}`,
    alternates: { canonical: `/products/mazon/${product.slugOrId}` },
    openGraph: {
      type: "website",
      title: product.title,
      description,
      url,
      images: product.images.slice(0, 4).map((img) => ({ url: img })),
    },
  };
}

export default async function MazonProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ attrs?: string }>;
}) {
  const { slug } = await params;
  const { attrs } = await searchParams;
  const initialAttrs = parseAttrsQuery(attrs);
  const product = await fetchMazonProductBySlug(slug);
  if (!product) notFound();

  // اگه مهلت اولویتِ یه‌نفر برای این محصول تموم شده باشه و هنوز موجودی باشه، نوبت به نفر بعدی می‌رسه
  await advanceExpiredReservationQueues(product.id);

  const session = await auth();

  const [
    relatedProducts,
    similarProducts,
    breadcrumb,
    ratingSummary,
    purchaseCount,
    questionCount,
    wishlistedIds,
    fixedAttributes,
    returnPolicyText,
    nonReturnableProductsEnabled,
    sizeGuideImage,
    viewCount24h,
    isLowestPrice10d,
    priceHistory,
    showcasedCoupons,
  ] = await Promise.all([
    fetchFrequentlyBoughtTogether(product.id),
    fetchRelatedProducts(product.id),
    product.categorySlug ? fetchCategoryBreadcrumb(product.categorySlug) : Promise.resolve([]),
    fetchProductRatingSummary(product.id),
    fetchProductPurchaseCount(product.id),
    fetchProductQuestionCount(product.id),
    fetchWishlistedProductIds(session?.user?.id),
    fetchFixedAttributesForCategory(product.categoryId),
    getSiteSetting(SITE_SETTING_KEYS.RETURN_POLICY_TEXT),
    getSiteSettingBool(SITE_SETTING_KEYS.NON_RETURNABLE_PRODUCTS_ENABLED),
    fetchSizeGuideImage(product.categoryId, product.brandId),
    fetchViewCount24h(product.id),
    fetchIsLowestPrice10d(product.id, product.price),
    fetchPriceHistory(product.id, product.price),
    fetchShowcasedCoupons(),
  ]);

  const isNonReturnable = nonReturnableProductsEnabled && product.isReturnable === false;

  // ثبت این بازدید و عکس قیمت امروز -- بدون بلاک کردن رندر صفحه
  recordProductView(product.id);
  recordPriceSnapshotIfNeeded(product.id, product.price);
  // چک اخطارهای کاهش قیمت با قیمتِ فعلی -- lazy روی بازدید صفحه (مثل صف موجودی)
  checkPriceAlerts(product.id, product.price);

  const variantOptions = product.variants.map((v) => ({
    id: v.id,
    stock: v.stock,
    priceDiff: v.priceDiff,
    values: v.values.map((val) => ({ attribute: val.attribute, value: val.value })),
  }));

  // جنسیت محصول (اگه داشته باشه) از روی مقادیر واقعی variant ها -- نه fixedValue دسته‌بندی،
  // چون جنسیت الان یه ویژگی معمولیه که هر محصول جدا مقدارش رو داره (دقیقاً مثل ترندیول)
  const productGender = variantOptions
    .flatMap((v) => v.values)
    .find((v) => v.attribute === "جنسیت")?.value;

  const breadcrumbItems = productGender
    ? [
        {
          name: productGender,
          href: `/products?attrs=${encodeURIComponent(`جنسیت~${productGender}`)}`,
        },
        ...breadcrumb.map((c) => ({
          name: `${c.name} ${productGender}`,
          href: `/products?categories=${c.slug}&attrs=${encodeURIComponent(`جنسیت~${productGender}`)}`,
        })),
      ]
    : breadcrumb.map((c) => ({ name: c.name, href: `/products?categories=${c.slug}` }));

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8">
      <ProductJsonLd
        product={{
          id: product.id,
          title: product.title,
          description: product.description,
          images: product.images,
          brand: product.brand,
          price: product.price,
          originalPrice: product.originalPrice,
          discount: product.discount,
          rating: ratingSummary.avg,
          reviewCount: ratingSummary.count,
          categoryName: product.categoryName,
        }}
        url={siteUrl(`/products/mazon/${product.slugOrId}`)}
      />
      <RecentlyViewedRecorder
        product={{
          id: product.id,
          source: "MAZON",
          slugOrId: product.slugOrId,
          title: product.title,
          image: product.image,
          price: product.price,
          originalPrice: product.originalPrice,
          discount: product.discount,
          href: `/products/mazon/${product.slugOrId}`,
          viewedAt: new Date().toISOString(),
        }}
      />
      <Breadcrumb
        items={[
          ...breadcrumbItems,
          { name: product.title },
        ]}
      />

      <ColorSyncProvider>
      {/* گالری خودش max-w-[440px] دارد -- با grid-cols-2 (۱fr ۱fr) یه فضای
          خالی بی‌معنی بین عکس و توضیحات می‌افتاد؛ عرض ستون دقیقاً همون‌قدره */}
      <div className="grid md:grid-cols-[440px_1fr] gap-8">
      <ProductGallery images={product.images} title={product.title} colorImages={product.colorImages} videoUrl={product.videoUrl} />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="ribbon-tag inline-block font-bold">✦ موجود در مزون</span>
        </div>
        {product.flashSale && (
          <div className="mb-3 inline-flex items-center gap-2 bg-[var(--color-ochre)] text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <span>⚡ حراج فلش — فقط {product.flashSale.stock} عدد باقی مانده</span>
            <CountdownTimer endsAt={product.flashSale.endsAt} className="font-mono" />
          </div>
        )}
        {product.brand && (
          <p className="text-sm text-[var(--color-muted)] mb-1">{product.brand}</p>
        )}
        <h1 className="text-2xl font-extrabold mb-1">{product.title}</h1>
        <p className="text-xs text-[var(--color-muted)] mb-3">
          کد محصول: {productDisplayCode(product.id)}
        </p>

        {viewCount24h > 0 && (
          <p className="text-xs text-[var(--color-muted)] mb-2">
            👁 در ۲۴ ساعت گذشته {viewCount24h.toLocaleString("fa-IR")} نفر این صفحه رو دیدن
          </p>
        )}

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <a href="#reviews" className="flex items-center gap-2 w-fit">
            <span className="flex gap-0.5 text-[var(--color-ochre)] text-sm">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n}>{n <= Math.round(ratingSummary.avg) ? "★" : "☆"}</span>
              ))}
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              {ratingSummary.count > 0
                ? `${ratingSummary.avg.toFixed(1)} (${ratingSummary.count.toLocaleString("fa-IR")} نظر)`
                : "هنوز نظری ثبت نشده"}
            </span>
          </a>
          {questionCount > 0 && (
            <>
              <span className="text-[var(--color-muted)] text-xs">·</span>
              <a href="#qa" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-wine)]">
                {questionCount.toLocaleString("fa-IR")} سوال‌وپاسخ
              </a>
            </>
          )}
        </div>

        {purchaseCount > 0 && (
          <p className="text-xs text-[var(--color-muted)] mb-4">
            🛍 {purchaseCount.toLocaleString("fa-IR")} نفر این کالا رو خریدن
          </p>
        )}

        {isLowestPrice10d && (
          <p className="text-xs font-bold text-emerald-700 mb-2">
            ↘ کمترین قیمت ۱۰ روز اخیر
          </p>
        )}

        {showcasedCoupons.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {showcasedCoupons.map((c) => (
              <span
                key={c.code}
                className="text-xs font-bold text-[var(--color-wine)] bg-[var(--color-wine)]/10 border border-[var(--color-wine)]/30 rounded-full px-3 py-1"
              >
                با کد{" "}
                <span dir="ltr">{c.code}</span>{" "}
                {c.type === "FREE_SHIP"
                  ? "ارسال رایگان بگیر"
                  : c.type === "FIXED"
                    ? `${c.value.toLocaleString("fa-IR")} تومان تخفیف بگیر`
                    : `${c.value.toLocaleString("fa-IR")}٪ تخفیف بگیر`}
              </span>
            ))}
          </div>
        )}

        <AddToCartForm
          productId={product.id}
          slugOrId={product.slugOrId}
          source="MAZON"
          title={product.title}
          image={product.image}
          basePrice={product.price}
          originalPrice={product.originalPrice}
          discount={product.discount}
          variants={variantOptions}
          flashSaleId={product.flashSale?.id}
          attributeGroupMap={product.attributeGroupMap}
          colorImages={product.colorImages}
          isWishlisted={wishlistedIds.has(product.id)}
          fastShipping={product.fastShipping}
          sizeGuideImage={sizeGuideImage?.imageUrl}
          sizeGuideId={sizeGuideImage?.id}
          initialAttrs={initialAttrs}
        />

        <div className="mt-3">
          <CompareToggleButton
            product={{
              id: product.id,
              slug: product.slugOrId,
              title: product.title,
              image: product.image,
              price: product.price,
              originalPrice: product.originalPrice,
              discount: product.discount,
              brand: product.brand ?? null,
              categoryName: product.categoryName ?? null,
              fastShipping: Boolean(product.fastShipping),
              rating: {
                avg: ratingSummary.avg,
                count: ratingSummary.count,
              },
              specifications: [],
              attributes: [],
            }}
          />
        </div>

        <PriceAlertWidget productId={product.id} currentPrice={product.price} />

        <p className="mt-4 text-xs leading-relaxed border-t cut-line pt-4">
          {isNonReturnable ? (
            <span className="text-red-600 font-medium">این محصول قابل مرجوع نیست.</span>
          ) : (
            <>
              <strong className="text-[var(--color-ink)]">شرایط مرجوع کردن کالا: </strong>
              <span className="text-[var(--color-muted)]">{returnPolicyText}</span>
            </>
          )}
        </p>

        <div className="mt-8 pt-6 border-t cut-line">
          <h2 className="font-bold mb-2">توضیحات محصول</h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>

        {product.careInstructions && (
          <div className="mt-8 pt-6 border-t cut-line">
            <h2 className="font-bold mb-2">نحوه مصرف / نگهداری</h2>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-line">
              {product.careInstructions}
            </p>
          </div>
        )}

        {(fixedAttributes.length > 0 || product.specifications.length > 0) && (
          <div className="mt-8 pt-6 border-t cut-line">
            <h2 className="font-bold mb-3">ویژگی‌های محصول</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {fixedAttributes.map((attr) => (
                <div
                  key={attr.name}
                  className="flex items-center justify-between gap-3 bg-[var(--color-linen-dim)] rounded-lg px-4 py-3 text-sm"
                >
                  <span className="text-[var(--color-muted)]">{attr.name}</span>
                  <span className="font-bold">{attr.value}</span>
                </div>
              ))}
              {product.specifications.map((spec) => (
                <div
                  key={spec.id}
                  className="flex items-center justify-between gap-3 bg-[var(--color-linen-dim)] rounded-lg px-4 py-3 text-sm"
                >
                  <span className="text-[var(--color-muted)]">{spec.label}</span>
                  <span className="font-bold">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
      </ColorSyncProvider>

      {priceHistory.points.length >= 2 && (
        <section className="mt-10 pt-8 border-t cut-line">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-bold text-lg">تاریخچه قیمت</h2>
            <p className="text-xs text-[var(--color-muted)]">
              {priceHistory.isLowest && (
                <span className="font-bold text-emerald-700 ml-2">↘ قیمت فعلی کمترین قیمت است</span>
              )}
              در {priceHistory.dayCount.toLocaleString("fa-IR")} روز اخیر
            </p>
          </div>
          <div className="grid md:grid-cols-[1fr_180px] gap-6 items-start">
            <PriceHistoryChart history={priceHistory} />
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2 text-sm">
              <div className="bg-[var(--color-linen-dim)] rounded-lg px-3 py-2">
                <p className="text-[11px] text-[var(--color-muted)]">کمترین</p>
                <p className="font-bold">{priceHistory.min.toLocaleString("fa-IR")} تومان</p>
              </div>
              <div className="bg-[var(--color-linen-dim)] rounded-lg px-3 py-2">
                <p className="text-[11px] text-[var(--color-muted)]">بیشترین</p>
                <p className="font-bold">{priceHistory.max.toLocaleString("fa-IR")} تومان</p>
              </div>
              <div className="bg-[var(--color-linen-dim)] rounded-lg px-3 py-2">
                <p className="text-[11px] text-[var(--color-muted)]">میانگین</p>
                <p className="font-bold">{priceHistory.avg.toLocaleString("fa-IR")} تومان</p>
              </div>
              <div className="bg-[var(--color-linen-dim)] rounded-lg px-3 py-2">
                <p className="text-[11px] text-[var(--color-muted)]">قیمت فعلی</p>
                <p className="font-bold text-[var(--color-wine)]">{priceHistory.current.toLocaleString("fa-IR")} تومان</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-[var(--color-muted)] mt-3">
            نمودار بر اساس ثبت روزانه‌ی قیمت هنگام بازدید صفحه ساخته می‌شود.
          </p>
        </section>
      )}

      <ReviewsSection productId={product.id} productTitle={product.title} productImage={product.image} />
      <QASection productId={product.id} />

      {relatedProducts.length > 0 && (
        <section className="mt-10 pt-8 border-t cut-line">
          <h2 className="font-bold text-lg mb-6">این محصول رو خریدن، این‌ها رو هم خریدن</h2>
          <HorizontalProductCarousel products={relatedProducts} wishlistedIds={wishlistedIds} />
        </section>
      )}

      {/* توصیه‌گر همکاری‌فیلترینگ (recommend.ts) -- بر اساس تعامل کاربرانِ دیگه با
          این محصول (خرید/ویشلیست/نظر/اخطار قیمت)، نه صرفاً هم‌سفارشی؛ برای همین
          جدا از بخش «با هم خریدن» بالاست */}
      {similarProducts.length > 0 && (
        <section className="mt-10 pt-8 border-t cut-line">
          <h2 className="font-bold text-lg mb-6">محصولات مشابه</h2>
          <HorizontalProductCarousel products={similarProducts} wishlistedIds={wishlistedIds} />
        </section>
      )}
    </div>
  );
}

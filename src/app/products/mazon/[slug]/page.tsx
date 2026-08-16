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
} from "@/lib/products";
import { advanceExpiredReservationQueues } from "@/lib/stockNotify";
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
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";

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
    breadcrumb,
    ratingSummary,
    purchaseCount,
    questionCount,
    wishlistedIds,
    fixedAttributes,
    returnPolicyText,
    sizeGuideImage,
    viewCount24h,
    isLowestPrice10d,
  ] = await Promise.all([
    fetchFrequentlyBoughtTogether(product.id),
    product.categorySlug ? fetchCategoryBreadcrumb(product.categorySlug) : Promise.resolve([]),
    fetchProductRatingSummary(product.id),
    fetchProductPurchaseCount(product.id),
    fetchProductQuestionCount(product.id),
    fetchWishlistedProductIds(session?.user?.id),
    fetchFixedAttributesForCategory(product.categoryId),
    getSiteSetting(SITE_SETTING_KEYS.RETURN_POLICY_TEXT),
    fetchSizeGuideImage(product.categoryId, product.brandId),
    fetchViewCount24h(product.id),
    fetchIsLowestPrice10d(product.id, product.price),
  ]);

  // ثبت این بازدید و عکس قیمت امروز -- بدون بلاک کردن رندر صفحه
  recordProductView(product.id);
  recordPriceSnapshotIfNeeded(product.id, product.price);

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
      <ProductGallery images={product.images} title={product.title} colorImages={product.colorImages} />

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
          sizeGuideImage={sizeGuideImage}
          initialAttrs={initialAttrs}
        />

        <p className="mt-4 text-xs text-[var(--color-muted)] leading-relaxed border-t cut-line pt-4">
          <strong className="text-[var(--color-ink)]">شرایط مرجوع کردن کالا: </strong>
          {returnPolicyText}
        </p>

        <div className="mt-8 pt-6 border-t cut-line">
          <h2 className="font-bold mb-2">توضیحات محصول</h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>

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

      <ReviewsSection productId={product.id} />
      <QASection productId={product.id} />

      {relatedProducts.length > 0 && (
        <section className="mt-10 pt-8 border-t cut-line">
          <h2 className="font-bold text-lg mb-6">این محصول رو خریدن، این‌ها رو هم خریدن</h2>
          <HorizontalProductCarousel products={relatedProducts} wishlistedIds={wishlistedIds} />
        </section>
      )}
    </div>
  );
}

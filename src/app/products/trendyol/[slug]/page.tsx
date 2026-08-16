import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { fetchTrendyolProductById, fetchTrendyolProductsFromUrl, siteSlugToKind } from "@/lib/trendyol";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { fetchSimilarTrendyolProducts } from "@/lib/trendyolSimilarProducts";
import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";
import { prisma } from "@/lib/prisma";
import { TRENDYOL_RAW_CATEGORY_SENTINEL, buildExternalSiteUrl, encodeTrendyolCategoryParam } from "@/lib/externalSites";
import { parseAttrsQuery } from "@/lib/attrsQuery";
import { AddToCartForm } from "@/components/AddToCartForm";
import { ProductGallery } from "@/components/ProductGallery";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TrendyolProductLink } from "@/components/TrendyolProductLink";
import { TrendyolSimilarProducts } from "@/components/TrendyolSimilarProducts";
import { TrendyolBestSellers } from "@/components/TrendyolBestSellers";
import { ReviewsSection } from "@/components/ReviewsSection";
import { QASection } from "@/components/QASection";
import { AdminOriginalTitleCopy } from "@/components/AdminOriginalTitleCopy";
import { auth } from "@/lib/auth";

// از segment آدرس (مثلاً "896710400-cep-detayli-gri-basic-tisort-...") فقط
// contentId رو درمیاره -- همیشه اولین بخش قبل از اولین "-" هست
function extractContentIdFromSlug(slug: string): string | null {
  const match = slug.match(/^(\d+)(?:-|$)/);
  return match ? match[1] : null;
}

// محصولات دموی قدیمی (Fake Store API) با slug کاملاً عددی و بدون خط تیره
// شناسایی می‌شن (مثلاً "3") -- محصولات لایو واقعی همیشه بعد از contentId
// یه "-" و اسلاگ سئو دارن (مثلاً "896710400-cep-detayli-...")
function isLegacyDemoSlug(slug: string): boolean {
  return /^\d+$/.test(slug);
}

// بعضی additionalProperty های ترندیول (مثل «Yıkama Talimatı» / دستورالعمل
// شست‌وشو) به‌جای متن، لینک یه آیکون از CDN ترندیوله -- این‌ها رو باید عکس
// نشون بدیم، نه آدرس خام
function isImageUrl(value: string): boolean {
  return /^https?:\/\/\S+\.(png|jpe?g|webp|gif|svg)(\?\S*)?$/i.test(value.trim());
}

// نسخه‌ی قدیمی: محصول دموی Fake Store API -- برای سازگاری با محصولاتی که
// از قبل (قبل از اتصال لایو واقعی) در سبد/سفارش‌ها ذخیره شدن
async function LegacyDemoProductPage({ id }: { id: string }) {
  const product = await fetchTrendyolProductById(id);
  if (!product) notFound();

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 grid md:grid-cols-2 gap-10">
      <div className="relative aspect-square bg-[var(--color-linen-dim)] rounded-xl overflow-hidden">
        {product.image && (
          <Image src={product.image} alt={product.title} fill className="object-contain p-8" unoptimized />
        )}
      </div>

      <div>
        <span className="inline-block mb-3 text-xs font-bold px-2 py-1 rounded-full bg-white border cut-line">
          ترندیول
        </span>
        <h1 className="text-2xl font-extrabold mb-4">{product.title}</h1>

        <AddToCartForm
          productId={product.id}
          slugOrId={product.slugOrId}
          source="TRENDYOL"
          title={product.title}
          image={product.image}
          basePrice={product.price}
          originalPrice={product.originalPrice}
          discount={product.discount}
        />

        <div className="mt-8 pt-6 border-t cut-line">
          <h2 className="font-bold mb-2">توضیحات محصول</h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function TrendyolProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ attrs?: string }>;
}) {
  const { slug } = await params;
  const { attrs } = await searchParams;
  const initialAttrs = parseAttrsQuery(attrs);
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  if (isLegacyDemoSlug(slug)) {
    return <LegacyDemoProductPage id={slug} />;
  }

  const contentId = extractContentIdFromSlug(slug);
  if (!contentId) notFound();

  const trendyolUrl = await getCachedTrendyolProductUrl(contentId);
  if (!trendyolUrl) {
    // لینک کامل ترندیول رو نداریم (مثلاً کاربر مستقیم این آدرس رو باز کرده
    // بدون این‌که از کارت گرید کلیک کنه) -- فعلاً notFound؛ در فاز بعد می‌شه
    // یه fallback ساخت (مثلاً از روی contentId مستقیم صفحه رو حدس زد)
    notFound();
  }

  let product;
  try {
    product = await fetchTrendyolProductDetail(trendyolUrl);
  } catch (err) {
    console.warn("خطا در واکشی جزئیات محصول ترندیول:", err);
    await logTrendyolFetchFailure({ url: trendyolUrl, error: String(err), source: "product-detail" });
    notFound();
  }

  if (!product) notFound();

  // «محصولات مشابه» -- best-effort: این endpoint نیاز به یه سایز مشخص داره
  // (sizeVariantAttributeValue)، پس اگه محصول اصلاً سایزی نداشت (یا خطا داد)،
  // فقط این بخش رو خالی می‌ذاریم و کل صفحه رو نمی‌ترکونیم
  let similarProducts: Awaited<ReturnType<typeof fetchSimilarTrendyolProducts>> = [];
  if (product.sizes.length > 0) {
    try {
      similarProducts = await fetchSimilarTrendyolProducts(product.contentId, product.sizes[0], product.brand);
    } catch (err) {
      console.warn("خطا در واکشی محصولات مشابه ترندیول:", err);
      await logTrendyolFetchFailure({
        url: `similar-size-variant/${product.contentId}`,
        error: String(err),
        source: "similar-products",
      });
    }
  }

  // سبد خرید variant سایز رو با همون ساختار عمومی AddToCartForm پاس می‌دیم --
  // هر سایز یه "attribute" با نام "Beden" است؛ چون قیمت لحظه‌ای دقیق هر سایز
  // رو نداریم (فقط سایزهای موجود رو از JSON-LD داریم)، فعلاً priceDiff صفره
  const variantOptions = product.sizes.map((size) => ({
    id: `${product!.contentId}-${size}`,
    stock: product!.inStock ? (product!.quantity ?? 1) : 0,
    priceDiff: 0,
    values: [{ attribute: "Beden", value: size }],
  }));

  const discountPercent =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  // برای کلیک‌پذیر کردن بخش دسته‌بندی توی breadcrumb، اسم خام ترکی رو با
  // TrendyolCategoryCache تطبیق می‌دیم (best-effort -- momکنه یه اسم برگ توی چند
  // مسیر مادر متفاوت هم تکرار شده باشه، پس همیشه ۱۰۰٪ دقیق نیست) تا هم برچسب
  // فارسی‌شده‌ش رو نشون بدیم، هم لینکش کنیم به همون فیلتر توی /marketplaces/trendyol
  // برای ساختن آدرس‌های داخلی/جست‌وجوی زنده‌ی همین دسته، باید بدونیم این محصول
  // مال خودِ ترندیول بود یا میلا -- از دامنه‌ی همون URL کامل که برای واکشی جزئیات
  // استفاده شد تشخیص می‌دیم
  const siteSlug = (() => {
    try {
      return new URL(trendyolUrl).hostname.includes("trendyol-milla") ? "trendyol-milla" : "trendyol";
    } catch {
      return "trendyol";
    }
  })();

  // آدرس کامل محصول (وقتی از گرید/جست‌وجوی زنده کش شده) معمولاً merchantId رو
  // توی query string داره -- برای لینک‌کردن اسم برند به صفحه‌ی فروشگاه لازمش داریم
  const merchantId = (() => {
    try {
      return new URL(trendyolUrl).searchParams.get("merchantId");
    } catch {
      return null;
    }
  })();

  let categoryLabel = product.categoryName;
  let categoryHref: string | undefined;
  let bestSellers: Awaited<ReturnType<typeof fetchTrendyolProductsFromUrl>>["products"] = [];
  if (product.categoryName) {
    const cachedCategory = await prisma.trendyolCategoryCache.findFirst({
      where: { site: siteSlugToKind(siteSlug), nameTr: product.categoryName },
    });
    if (cachedCategory) {
      categoryLabel = cachedCategory.nameFa || cachedCategory.nameTr;
      categoryHref = `/marketplaces/${siteSlug}?attrs=${encodeURIComponent(
        `${TRENDYOL_RAW_CATEGORY_SENTINEL}~${encodeTrendyolCategoryParam(cachedCategory.param)}`
      )}`;

      // «پرفروش‌ترین‌های همین دسته» -- جای‌گزین ما برای ویجت «Popüler Ürünler»ی
      // خودِ ترندیول که با فچ جدای سمت کلاینت میاد و قابل رهگیری از سمت ما نیست
      try {
        const bestSellersUrl = await buildExternalSiteUrl(siteSlug, null, [
          { attributeName: TRENDYOL_RAW_CATEGORY_SENTINEL, value: cachedCategory.param },
        ]);
        if (bestSellersUrl) {
          const result = await fetchTrendyolProductsFromUrl(`${bestSellersUrl}&sst=BEST_SELLER`);
          // بدون url واقعی نمی‌شه صفحه‌ی مقصد رو کش کرد (پیش از ناوبری) و بدونش
          // fetchTrendyolProductDetail هم چیزی برای واکشی نداره -- کلیک روی
          // همچین آیتمی همیشه 404 می‌ده، پس اصلاً نشونش نمی‌دیم
          bestSellers = result.products
            .filter((p) => String(p.id) !== product!.contentId && !p.isAd && !!p.url)
            .slice(0, 8);
        }
      } catch (err) {
        console.warn("خطا در واکشی پرفروش‌ترین‌های دسته‌ی ترندیول:", err);
        await logTrendyolFetchFailure({
          url: `best-sellers-category/${cachedCategory.param}`,
          error: String(err),
          source: "best-sellers",
          siteSlug,
        });
      }
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8">
      <Breadcrumb
        items={[
          ...(categoryLabel ? [{ name: categoryLabel, href: categoryHref }] : []),
          { name: product.nameFa },
        ]}
      />

      {/* ستون گالری دقیقاً به‌اندازه‌ی عرض واقعیِ خودش (همون max-w-[440px] که
          خودِ ProductGallery داره) تعریف شده -- وگرنه با grid-cols-2 (۱fr ۱fr)،
          چون گالری خودش max-w دارد و توضیحات ندارد، یه فضای خالی حدود ۱۶۰px
          بین عکس و توضیحات می‌افتاد که هیچ محتوایی توش نبود */}
      <div className="grid md:grid-cols-[440px_1fr] gap-8">
        <ProductGallery images={product.images} title={product.nameFa} />

        <div>
          {product.brand && (
            merchantId ? (
              <Link
                href={`/marketplaces/${siteSlug}/store/${merchantId}`}
                className="text-sm text-[var(--color-muted)] mb-1 hover:text-[var(--color-wine)] hover:underline inline-block"
                dir="ltr"
              >
                {product.brand}
              </Link>
            ) : (
              <p className="text-sm text-[var(--color-muted)] mb-1" dir="ltr">
                {product.brand}
              </p>
            )
          )}

          <h1 className="text-2xl font-extrabold mb-3">{product.nameFa}</h1>
          <AdminOriginalTitleCopy originalTitle={product.name} isAdmin={isAdmin} alwaysVisible />

          {/* رنگ‌های دیگه‌ی همین محصول -- هرکدوم لینک به صفحه‌ی جدای خودش، با
              کش خودکار آدرس ترندیول قبل از ناوبری (وگرنه صفحه‌ی مقصد 404 می‌ده) */}
          {product.colorVariants.length > 1 && (
            <div className="mb-4">
              <p className="text-sm font-bold mb-2">رنگ</p>
              <div className="flex items-center gap-2 flex-wrap">
                {product.colorVariants.map((v) => (
                  <TrendyolProductLink
                    key={v.contentId}
                    contentId={v.contentId}
                    trendyolUrl={v.url}
                    title={v.colorName}
                    className={`relative w-12 h-14 rounded-md overflow-hidden border-2 shrink-0 block ${
                      v.contentId === product!.contentId
                        ? "border-[var(--color-wine)]"
                        : "border-transparent hover:border-[var(--color-muted)]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.image} alt={v.colorName} className="absolute inset-0 w-full h-full object-cover" />
                  </TrendyolProductLink>
                ))}
              </div>
            </div>
          )}

          <AddToCartForm
            productId={`trendyol-${product.contentId}`}
            slugOrId={product.contentId}
            source="TRENDYOL"
            title={product.nameFa}
            image={product.images[0] ?? ""}
            basePrice={product.price ?? 0}
            originalPrice={product.originalPrice ?? undefined}
            discount={discountPercent}
            variants={variantOptions.length > 0 ? variantOptions : undefined}
            initialAttrs={initialAttrs}
          />

          {product.attributes.length > 0 && (
            <div className="mt-8 pt-6 border-t cut-line">
              <h2 className="font-bold mb-3">ویژگی‌های محصول</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {product.attributes.map((attr) => (
                  <div
                    key={attr.name}
                    className="flex items-center justify-between gap-3 bg-[var(--color-linen-dim)] rounded-lg px-4 py-3 text-sm"
                  >
                    <span className="text-[var(--color-muted)]">{attr.name}</span>
                    {isImageUrl(attr.value) ? (
                      // بعضی ویژگی‌ها (مثل «دستورالعمل شست‌وشو») مقدارشون یه لینک
                      // عکس (آیکون) از CDN ترندیوله، نه متن -- باید خودِ عکس نشون
                      // داده بشه، نه آدرس خامش
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attr.value} alt={attr.name} className="h-8 w-auto object-contain" />
                    ) : (
                      <span className="font-bold">{attr.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <TrendyolSimilarProducts products={similarProducts} isAdmin={isAdmin} />
      <TrendyolBestSellers products={bestSellers} isAdmin={isAdmin} />

      <ReviewsSection externalId={product.contentId} />
      <QASection externalId={product.contentId} />
    </div>
  );
}


import { cache } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { fetchTrendyolProductById, fetchTrendyolProductsFromUrl, siteSlugToKind } from "@/lib/trendyol";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { fetchSimilarTrendyolProducts } from "@/lib/trendyolSimilarProducts";
import { fetchFrequentlyBoughtTogether } from "@/lib/products";
import { HorizontalProductCarousel } from "@/components/HorizontalProductCarousel";
import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";
import { prisma } from "@/lib/prisma";
import { getSiteSetting, getSiteSettingBool, fetchTrustBadges, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { recordTrendyolProductView, fetchRecentTrendyolViewersCount } from "@/lib/trendyolProductViews";
import { LiveViewersBadge } from "@/components/LiveViewersBadge";
import { TrustBadgesInline } from "@/components/TrustBadgesInline";
import { ShippingInfoBox } from "@/components/ShippingInfoBox";
import { getFeatureFlags } from "@/lib/featureFlags";
import { PriceReportWidget } from "@/components/PriceReportWidget";
import { TrendyolOtherSellers } from "@/components/TrendyolOtherSellers";
import { TRENDYOL_RAW_CATEGORY_SENTINEL, buildExternalSiteUrl, encodeTrendyolCategoryParam } from "@/lib/externalSites";
import { parseAttrsQuery } from "@/lib/attrsQuery";
import { toProxiedImageUrl } from "@/lib/imageProxy";
import { AddToCartForm } from "@/components/AddToCartForm";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductCampaigns } from "@/components/ProductCampaigns";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TrendyolProductLink } from "@/components/TrendyolProductLink";
import { TrendyolSimilarProducts } from "@/components/TrendyolSimilarProducts";
import { TrendyolBestSellers } from "@/components/TrendyolBestSellers";
import { ReviewsSection } from "@/components/ReviewsSection";
import { QASection } from "@/components/QASection";
import { AdminOriginalTitleCopy } from "@/components/AdminOriginalTitleCopy";
import { AdminOriginalLinkCopy } from "@/components/AdminOriginalLinkCopy";
import { AdminClickToTranslate } from "@/components/AdminClickToTranslate";
import { RecentlyViewedRecorder } from "@/components/RecentlyViewedRecorder";
import { CurrentMarketplaceSync } from "@/components/CurrentMarketplaceSync";
import { auth } from "@/lib/auth";
import { ProductJsonLd } from "@/components/ProductJsonLd";
import { toMetaDescription, priceFa, siteUrl } from "@/lib/seo";
import type { Metadata } from "next";

// Cloudflareِ ترندیول گاهی به یه fallback مرورگرِ واقعی (Playwright) نیاز داره که
// خودش می‌تونه ~۱۵-۲۰ ثانیه طول بکشه -- مهلتِ پیش‌فرضِ Vercel (۱۰ ثانیه) کافی نیست
export const maxDuration = 60;

// از segment آدرس (مثلاً "896710400-cep-detayli-gri-basic-tisort-...") فقط
// contentId رو درمیاره -- همیشه اولین بخش قبل از اولین "-" هست
function extractContentIdFromSlug(slug: string): string | null {
  const match = slug.match(/^(\d+)(?:-|$)/);
  return match ? match[1] : null;
}

// محصولات دموی قدیمی (Fake Store API) با شناسه‌های ۱ تا ۲۰ ثبت شدن، پس یه
// slug کاملاً عددی و کوتاه (مثلاً "3") همیشه دمویی‌ست. محصولات لایو واقعی
// معمولاً بعد از contentId یه "-" و اسلاگ سئو دارن (مثلاً "896710400-cep-
// detayli-...")، ولی بعضی جاها (مثل لینک‌سازیِ صفحه‌ی wishlist از روی
// snapshot) فقط contentId خام رو بدون اسلاگ می‌سازن -- چون contentId های
// واقعیِ ترندیول همیشه چندین‌رقمی‌ان (هیچ‌وقت زیر هزار)، صرفاً «تماماً عددی
// بودن» کافی نیست؛ باید کوتاه هم باشه، وگرنه یه contentId واقعیِ بدون اسلاگ
// به‌اشتباه به صفحه‌ی دموی قدیمی (که notFound می‌ده) می‌رفت
function isLegacyDemoSlug(slug: string): boolean {
  return /^\d{1,3}$/.test(slug);
}

// generateMetadata و خودِ صفحه هر دو جزئیات رو می‌خوان -- بدون cache() هر بازدید
// دو درخواستِ کامل به ترندیول (و گاهی دو بار fallbackِ مرورگر) می‌زد
const getTrendyolProductDetail = cache(fetchTrendyolProductDetail);

// متادیتای سئو صفحه‌ی محصول ترندیول -- آدرس از کشِ URL کامل خوانده می‌شود و
// جزئیات از خود ترندیول (best-effort؛ اگه خطا داد متادیتای پیش‌فرض می‌ماند)
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const contentId = extractContentIdFromSlug(slug);
  if (!contentId || isLegacyDemoSlug(slug)) return {};

  try {
    const trendyolUrl = await getCachedTrendyolProductUrl(contentId);
    if (!trendyolUrl) return {};
    const product = await getTrendyolProductDetail(trendyolUrl);
    if (!product) return {};

    const description = toMetaDescription(product.name);
    const url = siteUrl(`/products/trendyol/${encodeURIComponent(slug)}`);

    return {
      title: product.nameFa,
      description: description || `خرید ${product.nameFa} — ${priceFa(product.price ?? 0)}`,
      alternates: { canonical: `/products/trendyol/${encodeURIComponent(slug)}` },
      openGraph: {
        type: "website",
        title: product.nameFa,
        description,
        url,
        images: product.images.slice(0, 4).map((img) => ({ url: img })),
      },
    };
  } catch {
    return {};
  }
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
  searchParams: Promise<{ attrs?: string; merchantId?: string }>;
}) {
  const { slug } = await params;
  const { attrs, merchantId: merchantIdParam } = await searchParams;
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
    product = await getTrendyolProductDetail(trendyolUrl);
  } catch (err) {
    console.warn("خطا در واکشی جزئیات محصول ترندیول:", err);
    await logTrendyolFetchFailure({ url: trendyolUrl, error: String(err), source: "product-detail" });
    notFound();
  }

  if (!product) notFound();

  // نشانه‌ی اجتماعیِ لحظه‌ای -- شمارشِ بازدیدهای *قبلِ* همین بازدید (تا خودِ
  // همین لودِ صفحه توی عددش حساب نشه)، بعد ثبتِ همین بازدید برایِ نفرِ بعدی --
  // بدونِ بلاک‌کردنِ رندرِ صفحه
  const socialProofWindowMinutes = Number(await getSiteSetting(SITE_SETTING_KEYS.SOCIAL_PROOF_WINDOW_MINUTES)) || 10;
  const socialProofMinCount = Number(await getSiteSetting(SITE_SETTING_KEYS.SOCIAL_PROOF_MIN_COUNT)) || 2;
  const recentViewersCount = await fetchRecentTrendyolViewersCount(product.contentId, socialProofWindowMinutes);
  recordTrendyolProductView(product.contentId);

  const trustBadges = await fetchTrustBadges();
  const shippingInfoEnabled = await getSiteSettingBool(SITE_SETTING_KEYS.SHIPPING_INFO_ENABLED);

  // «این محصول رو خریدن، این‌ها رو هم خریدن» -- هم‌خریدیِ واقعیِ سفارش‌های
  // پرداخت‌شده (مزون + ترندیول/میلا)؛ همون تابعی که روی صفحه‌ی مزون هم استفاده
  // می‌شه، فقط اینجا seed اش contentId ترندیوله نه شناسه‌ی مزون
  const crossSellMaxItems = Number(await getSiteSetting(SITE_SETTING_KEYS.CROSS_SELL_MAX_ITEMS)) || 4;
  const frequentlyBoughtTogether = await fetchFrequentlyBoughtTogether(product.contentId, crossSellMaxItems);

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
  // هر سایز یه "attribute" با نام «سایز» است (این اسمِ گروه، خودمون می‌سازیمش،
  // نه از عنوانِ خامِ ترندیول -- پس نیازی به دیکشنری/ترجمه ندارد)؛ چون قیمت
  // لحظه‌ای دقیق هر سایز رو نداریم (فقط سایزهای موجود رو از JSON-LD داریم)،
  // فعلاً priceDiff صفره
  // product.quantity از فیلدِ آنالیتیکسِ product_quantity توی dataLayer میاد که
  // طبق استانداردِ GA4 ecommerce، «تعدادِ موردنظر برای این ایونتِ مشاهده»ست (تقریباً
  // همیشه ۱)، نه موجودیِ واقعیِ انبار -- با تستِ زنده هم تایید شد: یه محصول که
  // خودِ ترندیول می‌گفت «بیش از ۵۰ عدد موجود»، همین فیلد ۱ برگردونده بود. پس
  // فقط علامتِ دودوییِ inStock رو معتبر می‌دونیم، نه این عدد -- تا سقفِ کاذب
  // نشون ندیم؛ اگه موجوده، سقفِ مشخصی نمی‌ذاریم (null)
  // برخلاف سایز، رنگ توی ترندیول یه attribute قابل‌انتخاب توی همین صفحه نیست --
  // هر رنگ صفحه‌ی محصول جدای خودشو داره (سوییچ رنگ بالاتر = ناوبری به صفحه‌ی
  // دیگه). پس رنگِ «انتخاب‌شده» همیشه همون رنگِ همین صفحه‌ست؛ باید جدا به
  // سبد/سفارش پاس بشه، وگرنه توی سبد/فاکتور فقط سایز دیده می‌شه، نه رنگ.
  // ترجیحاً از additionalProperty «رنگ» (که مثل بقیه‌ی ویژگی‌ها ترجمه‌شده، مثلاً
  // «مشکی») استفاده می‌کنیم، نه colorName خامِ JSON-LD (که ترکی/انگلیسیه مثل SİYAH)
  const currentColorName =
    product.attributes.find((a) => a.name === "رنگ")?.value ??
    product.colorVariants.find((v) => v.contentId === product!.contentId)?.colorName;

  const variantOptions = product.sizes.map((size) => ({
    id: `${product!.contentId}-${size}`,
    stock: product!.inStock ? null : 0,
    priceDiff: 0,
    values: [{ attribute: "سایز", value: size }],
  }));

  // وقتی از لیستِ «فروشنده‌های دیگر» با ?merchantId=... وارد این صفحه شده باشیم،
  // دقیقاً مثلِ خودِ ترندیول، کلِ صفحه از دیدِ همون فروشنده رندر می‌شه: قیمت/تخفیفِ
  // بالای صفحه از قیمتِ همون فروشنده میاد، و فروشنده‌ی پیش‌فرضِ قبلی به لیستِ
  // «فروشنده‌های دیگر» منتقل می‌شه. نیازی به فچِ زنده‌ی جدید نیست -- otherSellers[]
  // از همون یه فچِ موجود، قیمتِ همه‌ی فروشنده‌ها رو از قبل داره
  const requestedMerchantId = merchantIdParam ? Number(merchantIdParam) : null;
  const selectedSeller =
    requestedMerchantId != null && Number.isFinite(requestedMerchantId)
      ? product.otherSellers.find((s) => s.merchantId === requestedMerchantId && s.price != null) ?? null
      : null;

  const effectivePrice = selectedSeller?.price ?? product.price;
  const effectiveOriginalPrice = selectedSeller ? selectedSeller.originalPrice : product.originalPrice;
  const effectivePriceTL = selectedSeller?.priceTL ?? product.priceTL;
  const effectiveOriginalPriceTL = selectedSeller ? selectedSeller.originalPriceTL : product.originalPriceTL;

  const displayCurrentSeller = selectedSeller
    ? {
        merchantId: selectedSeller.merchantId,
        name: selectedSeller.name,
        score: selectedSeller.score,
        scoreColor: selectedSeller.scoreColor,
        price: selectedSeller.price,
        originalPrice: selectedSeller.originalPrice,
        priceTL: selectedSeller.priceTL,
        originalPriceTL: selectedSeller.originalPriceTL,
        campaignLabel: selectedSeller.campaignLabel,
        variantLabel: selectedSeller.variantLabel,
      }
    : product.currentSeller;

  const displayOtherSellers = selectedSeller
    ? [
        ...(product.currentSeller
          ? [
              {
                merchantId: product.currentSeller.merchantId,
                name: product.currentSeller.name,
                score: product.currentSeller.score,
                scoreColor: product.currentSeller.scoreColor,
                price: product.currentSeller.price,
                originalPrice: product.currentSeller.originalPrice,
                priceTL: product.currentSeller.priceTL,
                originalPriceTL: product.currentSeller.originalPriceTL,
                campaignLabel: product.currentSeller.campaignLabel,
                inStock: product.inStock,
                freeCargo: false,
                variantLabel: product.currentSeller.variantLabel,
              },
            ]
          : []),
        ...product.otherSellers.filter((s) => s.merchantId !== selectedSeller.merchantId),
      ].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    : product.otherSellers;

  // اگه نرخِ لیر توی تنظیمات ثبت نشده باشه، effectivePrice/effectiveOriginalPrice
  // (تومان) هردو صفرن -- این یعنی شرطِ اول همیشه false می‌شه و تخفیفِ واقعی
  // اصلاً به AddToCartForm نمی‌رسه (نه فقط قیمتِ نهایی، که قبلاً fallback به
  // لیر داره، بلکه خودِ محاسبه‌ی درصد). پس اینجا هم یه fallback به قیمتِ خامِ
  // لیر لازمه، وگرنه خطِ روی قیمتِ قبلی هیچ‌وقت نشون داده نمی‌شه
  const discountPercent =
    effectiveOriginalPrice && effectivePrice && effectiveOriginalPrice > effectivePrice
      ? Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100)
      : effectiveOriginalPriceTL && effectivePriceTL && effectiveOriginalPriceTL > effectivePriceTL
        ? Math.round(((effectiveOriginalPriceTL - effectivePriceTL) / effectiveOriginalPriceTL) * 100)
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

  // اسمِ همون سایتِ خارجی (ترندیول/میلا) برای بخشِ دومِ breadcrumb -- دقیقاً از
  // همون جدولِ ExternalSite که اسمِ نمایشیِ لینک‌های بالای صفحه رو هم می‌ده، تا
  // اگه ادمین اسمش رو عوض کرد، اینجا هم خودکار هماهنگ بمونه
  const externalSite = await prisma.externalSite.findUnique({
    where: { slug: siteSlug },
    select: { id: true, name: true, isReturnable: true, showOtherSellers: true },
  });
  const siteLabel = externalSite?.name ?? (siteSlug === "trendyol-milla" ? "میلا" : "ترندیول");
  const nonReturnableProductsEnabled = await getSiteSettingBool(SITE_SETTING_KEYS.NON_RETURNABLE_PRODUCTS_ENABLED);
  const isNonReturnable = nonReturnableProductsEnabled && externalSite?.isReturnable === false;
  const flags = await getFeatureFlags();

  let categoryLabel = product.categoryName;
  let categoryHref: string | undefined;
  let bestSellers: Awaited<ReturnType<typeof fetchTrendyolProductsFromUrl>>["products"] = [];
  // برای پیدا کردن ردیفِ کش، باید اسمِ خامِ ترکی رو استفاده کنیم (categoryNameTr)،
  // نه categoryName که از قبل ترجمه شده -- وگرنه چون TrendyolCategoryCache.nameTr
  // همیشه ترکیه، تطبیق تقریباً هیچ‌وقت پیدا نمی‌شه (حتی وقتی برچسبِ فارسی درست
  // نشون داده می‌شه، چون آن از مسیر ترجمه‌ی جدای دیگه‌ای اومده)
  if (product.categoryNameTr) {
    const cachedCategory = await prisma.trendyolCategoryCache.findFirst({
      where: { site: siteSlugToKind(siteSlug), nameTr: product.categoryNameTr },
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
  // طبقِ درخواستِ صریح («کلِ روبمپ باید قابل‌کلیک باشه») -- اگه دسته‌بندیِ این
  // محصول توی TrendyolCategoryCache سینک نشده باشه (پس wc= دقیقش رو نداریم)،
  // به‌جای نمایشِ متنِ بی‌لینک، یه سرچِ متنی روی همون اسمِ دسته می‌زنیم؛ خودِ
  // صفحه‌ی سرچ (parseSearchQueryToFilters) اگه اسم دقیقاً با یه دسته مچ بشه
  // خودکار به فیلترِ همون دسته ریدایرکت می‌کنه، وگرنه لااقل یه نتیجه‌ی مرتبط می‌ده
  if (categoryLabel && !categoryHref) {
    categoryHref = `/marketplaces/${siteSlug}?q=${encodeURIComponent(categoryLabel)}`;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8">
      <ProductJsonLd
        product={{
          id: `trendyol-${product.contentId}`,
          title: product.nameFa,
          description: product.name,
          images: product.images,
          brand: product.brand,
          price: product.price ?? 0,
          originalPrice: product.originalPrice ?? product.price ?? 0,
          discount: discountPercent,
          categoryName: product.categoryName ?? undefined,
        }}
        url={siteUrl(`/products/trendyol/${encodeURIComponent(slug)}`)}
      />
      <CurrentMarketplaceSync siteSlug={siteSlug} />
      <RecentlyViewedRecorder
        product={{
          id: `trendyol-${product.contentId}`,
          source: "TRENDYOL",
          slugOrId: slug,
          title: product.nameFa,
          image: product.images[0] ?? "",
          price: product.price ?? 0,
          originalPrice: product.originalPrice ?? product.price ?? 0,
          discount: discountPercent,
          href: `/products/trendyol/${slug}`,
          viewedAt: new Date().toISOString(),
        }}
      />
      <Breadcrumb
        items={[
          { name: siteLabel, href: `/marketplaces/${siteSlug}` },
          ...(categoryLabel ? [{ name: categoryLabel, href: categoryHref }] : []),
          { name: product.nameFa },
        ]}
      />

      {/* ستون گالری دقیقاً به‌اندازه‌ی عرض واقعیِ خودش (همون max-w-[440px] که
          خودِ ProductGallery داره) تعریف شده -- وگرنه با grid-cols-2 (۱fr ۱fr)،
          چون گالری خودش max-w دارد و توضیحات ندارد، یه فضای خالی حدود ۱۶۰px
          بین عکس و توضیحات می‌افتاد که هیچ محتوایی توش نبود.
          grid-cols-1 صریح توی موبایل لازمه (نه فقط تکیه به رفتارِ پیش‌فرضِ
          grid): بدونش، تراکِ تکِ ضمنی min-width:auto می‌گیره، یعنی عکسِ داخلِ
          ProductGallery (که خودش تا max-w-[440px] می‌خواد پر بشه) کلِ تراک/گرید/
          صفحه رو تا ۴۴۰px می‌کشید و توی موبایلِ باریک‌تر افقی اسکرول می‌شد --
          grid-cols-1 با minmax(0,1fr) این min-width رو صفر می‌کنه */}
      <div className="grid grid-cols-1 md:grid-cols-[440px_1fr] lg:grid-cols-[440px_1fr_280px] gap-8">
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

          <h1 className="text-2xl font-extrabold mb-3">
            <AdminClickToTranslate text={product.nameFa} isAdmin={isAdmin} />
          </h1>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <AdminOriginalTitleCopy originalTitle={product.name} isAdmin={isAdmin} alwaysVisible brand={product.brand} />
            <AdminOriginalLinkCopy url={product.url} isAdmin={isAdmin} />
          </div>

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

          {!product.inStock && (
            <p className="mb-3 text-sm font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2">
              این محصول در حال حاضر ناموجود است.
            </p>
          )}

          <LiveViewersBadge
            count={recentViewersCount}
            minCount={socialProofMinCount}
            windowMinutes={socialProofWindowMinutes}
          />

          <AddToCartForm
            productId={`trendyol-${product.contentId}`}
            slugOrId={product.contentId}
            source="TRENDYOL"
            title={product.nameFa}
            image={product.images[0] ?? ""}
            basePrice={effectivePrice ?? 0}
            originalPrice={effectiveOriginalPrice ?? undefined}
            priceTL={effectivePriceTL}
            originalPriceTL={effectiveOriginalPriceTL}
            isAdmin={isAdmin}
            discount={discountPercent}
            variants={variantOptions.length > 0 ? variantOptions : undefined}
            initialAttrs={initialAttrs}
            fixedVariantLabel={currentColorName ? `رنگ: ${currentColorName}` : undefined}
            siteLabel={siteLabel}
            merchantId={selectedSeller?.merchantId}
            merchantName={selectedSeller?.name}
          />

          <ShippingInfoBox variant="trendyol" enabled={shippingInfoEnabled} />

          <div className="mt-3">
            <TrustBadgesInline badges={trustBadges} />
          </div>

          {flags[SITE_SETTING_KEYS.FEATURE_CHEAPER_PRICE_REPORT] && (
            <PriceReportWidget externalId={product.contentId} currentPrice={effectivePrice ?? 0} />
          )}

          <p className="mt-4 text-xs border-t cut-line pt-4">
            {isNonReturnable ? (
              <span className="text-red-600 font-medium">کالاهای «{siteLabel}» قابل مرجوع نیستند.</span>
            ) : (
              <>
                <strong className="text-[var(--color-ink)]">شرایط مرجوع کردن کالا: </strong>
                <span className="text-[var(--color-muted)]">
                  کالای خارجی فقط در صورتِ خرابی، ارسالِ اشتباه یا نامناسب‌بودنِ سایز/رنگ قابلِ مرجوعه --
                  انصراف از خرید یا نپسندیدن شاملِ مرجوعی نمی‌شه.
                </span>
              </>
            )}
          </p>

          {product.attributes.length > 0 && (
            <div className="mt-8 pt-6 border-t cut-line">
              <h2 className="font-bold mb-3">ویژگی‌های محصول</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {product.attributes.map((attr) => (
                  <div
                    key={attr.name}
                    className="flex items-center justify-between gap-3 bg-[var(--color-linen-dim)] rounded-lg px-4 py-3 text-sm"
                  >
                    {/* min-w-0 لازمه چون این‌ها فرزندِ flex هستن -- بدونش، مقدارِ
                        ترجمه‌نشده‌ی طولانی (مثلاً یه اسمِ ویژگیِ ترکیِ بلند) عرضِ
                        خودش رو به‌جای شکستنِ خط، به کلِ ردیف/گرید/صفحه تحمیل
                        می‌کرد و صفحه توی موبایل افقی اسکرول می‌شد */}
                    <span className="text-[var(--color-muted)] min-w-0 break-words">
                      <AdminClickToTranslate text={attr.name} isAdmin={isAdmin} />
                    </span>
                    {isImageUrl(attr.value) ? (
                      // بعضی ویژگی‌ها (مثل «دستورالعمل شست‌وشو») مقدارشون یه لینک
                      // عکس (آیکون) از CDN ترندیوله، نه متن -- باید خودِ عکس نشون
                      // داده بشه، نه آدرس خامش
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={toProxiedImageUrl(attr.value)} alt={attr.name} className="h-8 w-auto object-contain shrink-0" />
                    ) : (
                      <span className="font-bold min-w-0 break-words text-left">
                        <AdminClickToTranslate text={attr.value} isAdmin={isAdmin} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ستونِ کنارِ محصول -- دقیقاً جایگاهِ «ÜRÜNÜN KAMPANYALARI» خودِ
            ترندیول (کنارِ عکس/اطلاعاتِ اصلی، نه بالای عنوان). توی صفحه‌های
            کوچیک‌تر (بدون این ستونِ سوم) زیرِ همه‌چیز می‌افته */}
        <div className="md:col-span-2 lg:col-span-1">
          {flags[SITE_SETTING_KEYS.FEATURE_TRENDYOL_CAMPAIGNS] && (
            <ProductCampaigns badges={product.campaignBadges} siteSlug={siteSlug} isAdmin={isAdmin} />
          )}

          {externalSite?.showOtherSellers !== false && (
            <TrendyolOtherSellers
              contentId={product.contentId}
              siteSlug={siteSlug}
              currentSeller={displayCurrentSeller}
              otherSellers={displayOtherSellers}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>

      {flags[SITE_SETTING_KEYS.FEATURE_FREQUENTLY_BOUGHT_TOGETHER] && frequentlyBoughtTogether.length > 0 && (
        <div className="mt-8 pt-6 border-t cut-line">
          <h2 className="font-bold mb-4">این محصول رو خریدن، این‌ها رو هم خریدن</h2>
          <HorizontalProductCarousel products={frequentlyBoughtTogether} wishlistedIds={new Set()} />
        </div>
      )}
      <TrendyolSimilarProducts products={similarProducts} isAdmin={isAdmin} />
      <TrendyolBestSellers products={bestSellers} isAdmin={isAdmin} />

      {flags[SITE_SETTING_KEYS.FEATURE_PRODUCT_REVIEWS] && (
        <ReviewsSection
          externalId={product.contentId}
          externalSiteId={externalSite?.id}
          productTitle={product.nameFa}
          productImage={product.images[0]}
        />
      )}
      {flags[SITE_SETTING_KEYS.FEATURE_PRODUCT_QA] && <QASection externalId={product.contentId} />}
    </div>
  );
}


"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { TrendyolLiveProduct } from "@/lib/trendyol";
import { TrendyolProductLink } from "@/components/TrendyolProductLink";
import { TrendyolQuickView } from "@/components/TrendyolQuickView";
import { WishlistButton } from "@/components/WishlistButton";
import { StarRating, VerifiedBadge, EyeIcon, getStripBadgeLabel } from "@/components/TrendyolBadges";
import { AdminOriginalTitleCopy } from "@/components/AdminOriginalTitleCopy";
import { AdminOriginalLinkCopy } from "@/components/AdminOriginalLinkCopy";
import { AdminClickToTranslate } from "@/components/AdminClickToTranslate";
import { sortByDiscountDesc } from "@/lib/discountPercent";

// میلا/ترندیول در مرز صفحه‌ها محصولات تکراری برمی‌گردونن (همان id) -- dedup
// به‌جای append خام، تا کلید React تکراری نشه (که باعث می‌شد کارت‌ها dup
// شوند و ارور console بده) و عدد کارت‌ها دقیق بمونه
export function dedupeProducts(
  current: TrendyolLiveProduct[],
  incoming: TrendyolLiveProduct[]
): TrendyolLiveProduct[] {
  const seen = new Set(current.map((p) => String(p.id)));
  const fresh = incoming.filter((p) => !seen.has(String(p.id)));
  return [...current, ...fresh];
}

// عکس‌های ترندیول/میلا از cdn.dsmcdn.com همیشه با یه سگمنتِ اندازه‌ی ثابت
// می‌رسن (مثلاً .../mnresize/400/-/...)، حتی اگه کارتِ گرید (خصوصاً موبایلِ
// ۲ستونه) خیلی کوچیک‌تر از ۴۰۰px نمایش بده. برای srcset یه نسخه‌ی کوچیک‌تر
// و یه نسخه‌ی بزرگ‌تر می‌سازیم -- روی خودِ URL پراکسی‌شده کار می‌کنه (نه دیتای
// خام)، پس نیازی به تغییرِ لایه‌ی داده/تایپ‌ها نیست. اگه فرمتِ آدرس فرق داشت،
// بی‌خطر همون URL اصلی برمی‌گرده
function resizeProxiedTrendyolImage(proxiedUrl: string, width: number): string {
  try {
    const u = new URL(proxiedUrl, "https://mudashop.vercel.app");
    const inner = u.searchParams.get("url");
    if (!inner) return proxiedUrl;
    const resized = inner.replace(/\/mnresize\/\d+\//, `/mnresize/${width}/`);
    if (resized === inner) return proxiedUrl;
    return `/api/image-proxy?url=${encodeURIComponent(resized)}`;
  } catch {
    return proxiedUrl;
  }
}

function TrendyolProductCard({
  p,
  index,
  onQuickView,
  isWishlisted,
  attrsQuery,
  minDiscountPercentToShow = 2,
}: {
  p: TrendyolLiveProduct;
  index: number;
  onQuickView: (p: TrendyolLiveProduct) => void;
  isWishlisted: boolean;
  attrsQuery?: string;
  minDiscountPercentToShow?: number;
}) {
  const gallery = p.images.length > 0 ? p.images : p.image ? [p.image] : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (gallery.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width; // 0 تا 1
    const index = Math.min(gallery.length - 1, Math.max(0, Math.floor(relativeX * gallery.length)));
    setActiveIndex(index);
  }

  function handleMouseLeave() {
    setActiveIndex(0);
  }

  const displayedImage = gallery[activeIndex];

  return (
    <TrendyolProductLink
      contentId={p.id}
      trendyolUrl={p.url}
      attrsQuery={attrsQuery}
      // min-w-0 لازمه چون این کارت مستقیم فرزندِ گریده -- بدونش، اسپنِ
      // whitespace-nowrapِ قیمت (برای جلوگیری از دوخطی‌شدنِ «تومان») می‌تونه
      // عریض‌تر از ستونِ گرید بشه و کلِ گرید/صفحه رو عرضی اسکرول‌پذیر کنه
      // (دقیقاً چیزی که با فیکسِ whitespace-nowrap موقعِ اعدادِ بزرگ پیش میومد)
      className="group flex flex-col h-full min-w-0 border cut-line rounded-lg bg-white hover:shadow-lg transition-shadow"
    >
      {/* rounded-t-lg مستقیم اینجا (نه overflow-hidden روی کلِ کارت) -- وگرنه
          پاپ‌آپِ ترجمه/ویرایشِ کلمه (که پایین‌ترِ همین کارت، زیرِ عنوان باز
          می‌شه) توسطِ همون overflow قطع/مخفی می‌شد */}
      <div
        className="relative aspect-[3/4] shrink-0 rounded-t-lg overflow-hidden bg-[var(--color-linen-dim)]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {displayedImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resizeProxiedTrendyolImage(displayedImage, 400)}
            srcSet={`${resizeProxiedTrendyolImage(displayedImage, 240)} 240w, ${resizeProxiedTrendyolImage(displayedImage, 480)} 480w`}
            sizes="(min-width: 768px) 22vw, (min-width: 640px) 31vw, 48vw"
            alt=""
            // ردیفِ اول (بالای تاخوردگی) eager، بقیه lazy -- طبقِ درخواستِ صریح
            // برای کاهشِ لودِ اولیه؛ ۴ کارتِ اول چون بیشترین breakpoint چهارستونه‌ست
            loading={index < 4 ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}

        {/* قلب علاقه‌مندی -- گوشه‌ی بالا-راست، جای خالی روی عکس (مهر بالا-چپه،
            نگاه سریع پایین-چپ، اسپانسری/نقاط پایین-وسط/راست) */}
        <WishlistButton
          trendyol={{
            externalId: String(p.id),
            title: p.nameFa,
            image: p.image ?? "",
            url: p.url ?? "",
            price: p.price ?? 0,
          }}
          initialWishlisted={isWishlisted}
          variant="trendyol-card"
        />

        {/* مهر دایره‌ای گوشه‌ی بالا-چپ -- طراحی خودمونه (رنگ+متن فارسی)، نه
            کپی دقیق گرافیک ترندیول، چون خودِ آدرس تصویر مهرشون توی داده‌ی خام
            همیشه خالی برمی‌گرده (stamps:{}) */}
        {p.campaignSeal && (
          <span
            className="absolute top-2 left-2 z-10 flex items-center justify-center text-center rounded-full text-white text-[9px] font-extrabold w-14 h-14 leading-tight p-1 shadow-md"
            style={{ background: p.campaignSeal.color }}
          >
            {p.campaignSeal.label}
          </span>
        )}

        {/* نشانگر شماره عکس -- پایین‌وسط، مثل ProductCard مزون */}
        {gallery.length > 1 && (
          <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1 z-10">
            {gallery.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === activeIndex ? "w-3 bg-white" : "w-1 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {p.isAd && (
          <span className="absolute bottom-2 right-2 text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white">
            اسپانسری
          </span>
        )}

        {/* دکمه‌ی «نگاه سریع» -- موقع هاور روی عکس ظاهر می‌شه، مثل Hızlı Bakış
            ترندیول؛ روی دستگاه‌های بدون ماوس (هاور بی‌معنی) همیشه نشون داده
            می‌شه، وگرنه توی اپ/موبایل اصلاً قابل‌کلیک نبود.
            preventDefault+stopPropagation لازمه چون این دکمه داخل
            TrendyolProductLink (یه <a>) هست و نباید ناوبری رو راه بندازه.
            hover:bg/hover:text تغییر رنگ موقع هاور مستقیم روی خودِ دکمه رو
            تضمین می‌کنه (نه فقط ظاهرشدنش موقع هاور روی عکس) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickView(p);
          }}
          className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-colors bg-white/95 hover:bg-[var(--color-wine)] text-[var(--color-ink)] hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow flex items-center gap-1.5 z-20 cursor-pointer"
        >
          <EyeIcon className="w-3.5 h-3.5" />
          نگاه سریع
        </button>
      </div>

      {/* بج نواری زیر عکس -- فقط برای type هایی که واقعاً از داده‌ی خام ترندیول
          تأیید کردیم (پرفروش‌ترین/پربازدیدترین/بیشترین‌امتیاز/محبوب‌ترین با
          رتبه، یا فروشنده‌ی موفق/مجاز/انتخاب اینفلوئنسر/با‌هم‌بخر با متن
          مستقیم) -- type های ناشناخته مخفی می‌مونن، نه یه متن ثابت اشتباه */}
      {p.stripBadge && getStripBadgeLabel(p.stripBadge.type, p.stripBadge.title) && (
        <div
          className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold text-white shrink-0"
          style={{ background: p.stripBadge.color }}
        >
          {p.stripBadge.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.stripBadge.icon} alt="" className="w-3 h-3" />
          )}
          <span>{getStripBadgeLabel(p.stripBadge.type, p.stripBadge.title)}</span>
        </div>
      )}

      <div className="p-3 flex flex-col flex-1">
        {p.brand && (
          <p className="text-xs font-bold text-[var(--color-muted)] mb-0.5 flex items-center gap-1" dir="ltr">
            {p.brand}
            {p.hasOfficialSellerBadge && (
              <span title="فروشنده‌ی رسمی/تاییدشده">
                <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
              </span>
            )}
          </p>
        )}
        <h3
          className="text-sm font-medium line-clamp-2 mb-1.5 min-h-[2.5rem]"
          dir="rtl"
        >
          <AdminClickToTranslate text={p.nameFa} isAdmin={isAdmin} />
        </h3>
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <AdminOriginalTitleCopy originalTitle={p.name} isAdmin={isAdmin} brand={p.brand} />
          {p.url && <AdminOriginalLinkCopy url={p.url} isAdmin={isAdmin} alwaysVisible={false} />}
        </div>

        {p.socialProofOrderCount && (
          <p className="text-[11px] text-[var(--color-muted)] mb-1">
            🛍 {p.socialProofOrderCount} کاربر اخیراً خریده‌اند
          </p>
        )}

        {p.socialProofFavoriteCount && (
          <p className="text-[11px] text-[var(--color-muted)] mb-1 flex items-center gap-1">
            <span className="text-[var(--color-wine)]">♥</span>
            {p.socialProofFavoriteCount} نفر پسندیدن!
          </p>
        )}

        {!!p.reviewCount && p.reviewCount > 0 && (
          <p className="text-[11px] text-[var(--color-muted)] mb-2 flex items-center gap-1">
            <StarRating rating={p.rating ?? 0} />
            <span className="font-bold text-[var(--color-ink)]">
              {(p.rating ?? 0).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}
            </span>
            <span>({p.reviewCount.toLocaleString("fa-IR")})</span>
            {p.hasReviewPhoto && <span title="نظرات دارای عکس">📷</span>}
          </p>
        )}

        {p.lowestPriceDurationDays && (
          <p className="text-[10px] font-bold text-emerald-700 mb-1">
            ↘ کمترین قیمت {p.lowestPriceDurationDays.toLocaleString("fa-IR")} روز اخیر
          </p>
        )}

        {(() => {
          const hasNormalDiscount = p.originalPrice != null && p.price != null && p.originalPrice > p.price;
          // برخلافِ تخفیفِ عادی (که خودِ ترندیول از قبل روی price اعمال کرده)،
          // تخفیفِ سبد شرطیه و روی دیتای خام اعمال نشده -- خودمون از روی درصد
          // حسابش می‌کنیم؛ درصدش هم با رنگِ سبز (نه برچسبِ متنیِ «تخفیفِ سبد»)
          const hasBasketDiscount = p.basketCampaignPercent != null && p.price != null;
          const finalPrice = hasBasketDiscount
            ? Math.round((p.price! * (1 - p.basketCampaignPercent! / 100)) / 1000) * 1000
            : p.price;
          const finalPriceLira =
            hasBasketDiscount && p.priceLira != null
              ? p.priceLira * (1 - p.basketCampaignPercent! / 100)
              : p.priceLira;
          // اگه هردو تخفیف باشن، به‌جای دوتا بجِ جدا، یه درصدِ کلی (نسبتِ
          // originalPrice به قیمتِ نهایی) نشون می‌دیم؛ و از دوتا قیمتِ
          // خط‌خورده‌ی احتمالی، فقط اولی (اصلی‌ترین/originalPrice) رو -- نه
          // قیمتِ میانیِ price رو هم -- تا شلوغ نشه
          const combinedPercent =
            hasNormalDiscount && hasBasketDiscount && finalPrice != null
              ? Math.round(((p.originalPrice! - finalPrice) / p.originalPrice!) * 100)
              : hasNormalDiscount
                ? Math.round(((p.originalPrice! - p.price!) / p.originalPrice!) * 100)
                : hasBasketDiscount
                  ? p.basketCampaignPercent!
                  : null;
          const struckValue = hasNormalDiscount ? p.originalPrice : hasBasketDiscount ? p.price : null;
          const struckLira = hasNormalDiscount ? p.originalPriceLira : hasBasketDiscount ? p.priceLira : null;
          // فقط برای ادمین -- تولتیقِ عدد خامِ لیرِ همون قیمت، برای تأییدِ سریعِ
          // نرخِ تبدیل بدون رفتن به صفحه‌ی جزئیات
          const liraTitle = (lira: number | null | undefined) =>
            isAdmin && lira != null ? `${lira.toLocaleString("en-US", { maximumFractionDigits: 2 })} TL` : undefined;
          return (
            <div className="flex items-baseline gap-2 mt-auto pt-1 flex-wrap">
              {combinedPercent != null && combinedPercent >= minDiscountPercentToShow && (
                <span
                  dir="ltr"
                  className={`text-[11px] font-bold text-white rounded px-1.5 py-0.5 ${
                    hasBasketDiscount ? "bg-emerald-600" : "bg-[var(--color-wine)]"
                  }`}
                >
                  ٪{combinedPercent.toLocaleString("fa-IR")}
                </span>
              )}
              {(() => {
                // اگه نرخِ لیر توی تنظیمات ثبت نشده باشه، تبدیل به تومان صفر
                // برمی‌گرده -- به‌جایِ «۰ تومان»ِ گمراه‌کننده، قیمتِ خامِ لیر
                // رو مستقیم نشون می‌دیم (برای همه، نه فقط تولتیقِ ادمین)
                const rateNotSet = !finalPrice && finalPriceLira != null && finalPriceLira > 0;
                if (rateNotSet) {
                  return (
                    <>
                      <span
                        className={`font-bold whitespace-nowrap ${hasBasketDiscount ? "text-emerald-600" : "text-[var(--color-wine)]"}`}
                      >
                        {Math.round(finalPriceLira).toLocaleString("fa-IR")} لیر
                      </span>
                      {struckLira != null && (
                        <span className="text-xs text-[var(--color-muted)] line-through whitespace-nowrap">
                          {Math.round(struckLira).toLocaleString("fa-IR")} لیر
                        </span>
                      )}
                    </>
                  );
                }
                return (
                  <>
                    {finalPrice != null && (
                      <span
                        className={`font-bold whitespace-nowrap ${hasBasketDiscount ? "text-emerald-600" : "text-[var(--color-wine)]"}`}
                        title={liraTitle(finalPriceLira)}
                      >
                        {finalPrice.toLocaleString("fa-IR")} تومان
                      </span>
                    )}
                    {struckValue != null && (
                      <span
                        className="text-xs text-[var(--color-muted)] line-through whitespace-nowrap"
                        title={liraTitle(struckLira)}
                      >
                        {struckValue.toLocaleString("fa-IR")}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          );
        })()}

        {/* دکمه‌ی خرید -- چون سایز/رنگ دقیق و موجودی واقعی رو فقط بعد از فچ
            جزئیات کامل داریم (نه توی همین کارت سبک گرید)، کلیک همون مودال
            «نگاه سریع» رو باز می‌کنه که انتخاب سایز + افزودن واقعی به سبد
            اونجا انجام می‌شه -- دقیقاً جایی که ترندیول هم دکمه‌ش رو می‌ذاره */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickView(p);
          }}
          className="mt-3 w-full border cut-line rounded-full py-2 text-sm font-medium hover:border-[var(--color-wine)] hover:text-[var(--color-wine)] transition-colors cursor-pointer"
        >
          افزودن به سبد
        </button>
      </div>
    </TrendyolProductLink>
  );
}

export function TrendyolLiveGrid({
  initialProducts,
  initialNextUrl,
  initialWishlistedIds = [],
  activeAttrsQuery,
  minDiscountPercentToShow = 2,
  discountMode,
}: {
  initialProducts: TrendyolLiveProduct[];
  initialNextUrl: string | null;
  initialWishlistedIds?: string[];
  activeAttrsQuery?: string;
  minDiscountPercentToShow?: number;
  // مرتب‌سازیِ «بیشترین تخفیف»: سرور فقط صفحه‌ی اول رو داده؛ بقیه‌ی صفحه‌ها یکی‌یکی
  // از اینجا (سمتِ مرورگر) گرفته، ادغام، و دوباره با درصدِ تخفیف مرتب می‌شن
  discountMode?: { tagNextUrl: string | null; lowestUrl: string };
}) {
  const [products, setProducts] = useState(initialProducts);
  const [nextUrl, setNextUrl] = useState(initialNextUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wishlistedIds = useMemo(() => new Set(initialWishlistedIds), [initialWishlistedIds]);
  // فقط یه instance از مودال «نگاه سریع» برای کل گرید -- نه یکی برای هر کارت --
  // تا هم DOM سنگین نشه هم مطمئن باشیم دو مودال همزمان باز نمی‌شه
  const [quickViewProduct, setQuickViewProduct] = useState<TrendyolLiveProduct | null>(null);
  const [scanStatus, setScanStatus] = useState("");

  useEffect(() => {
    if (!discountMode) return;
    let cancelled = false;
    (async () => {
      // پشت‌سرهم (نه هم‌زمان) -- دو درخواستِ هم‌زمان به ترندیول باعثِ ۴۰۳ و ریستِ کوکی می‌شه
      const jobs: { url: string; maxPages: number }[] = [];
      if (discountMode.tagNextUrl) jobs.push({ url: discountMode.tagNextUrl, maxPages: 3 });
      jobs.push({ url: discountMode.lowestUrl, maxPages: 2 });
      const totalSteps = jobs.reduce((n, j) => n + j.maxPages, 0);
      let step = 0;
      for (const job of jobs) {
        let url: string | null = job.url;
        for (let i = 0; i < job.maxPages && url; i++) {
          if (cancelled) return;
          step += 1;
          setScanStatus(`در حال بررسیِ محصولاتِ بیشتر (${step} از حداکثر ${totalSteps})...`);
          try {
            const res: Response = await fetch(`/api/trendyol/live?url=${encodeURIComponent(url)}`);
            if (!res.ok) break;
            const data: { products: TrendyolLiveProduct[]; nextUrl: string | null } = await res.json();
            if (cancelled) return;
            setProducts((prev) => sortByDiscountDesc(dedupeProducts(prev, data.products)));
            url = data.nextUrl ?? null;
          } catch {
            break;
          }
        }
      }
      if (!cancelled) setScanStatus("");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountMode?.lowestUrl]);

  // محصولات تبلیغاتی/اسپانسری ترندیول رو نشون نمی‌دیم -- نمایش جایگاه تبلیغاتی
  // یه سایت دیگه توی سایت خودمون گمراه‌کننده‌ست
  const visibleProducts = products.filter((p) => !p.isAd);

  async function loadMore() {
    if (!nextUrl || loading) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/trendyol/live?url=${encodeURIComponent(nextUrl)}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      const detail = typeof data.detail === "string" ? data.detail : "";
      setError(`${data.error ?? "خطا در بارگذاری محصولات بیشتر"}${detail ? `\nجزئیات: ${detail}` : ""}`);
      return;
    }
    setProducts((prev) => dedupeProducts(prev, data.products as TrendyolLiveProduct[]));
    setNextUrl(data.nextUrl);
  }

  // بارگذاری خودکار با اسکرول -- مثل خودِ ترندیول، دیگه نیازی به دکمه‌ی
  // «بارگذاری بیشتر» نیست. یه سنتینل نامرئی ته لیست می‌ذاریم؛ هر وقت وارد
  // viewport بشه (با ۶۰۰px حاشیه‌ی جلوتر، که کاربر اصلاً منتظر نمونه) صفحه‌ی
  // بعدی خودکار fetch می‌شه. rootMargin باعث می‌شه واکشی کمی زودتر از رسیدن
  // دقیق به ته صفحه شروع بشه، تجربه‌ای روان‌تر بدون پرش/تاخیر محسوس.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!nextUrl) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextUrl]);

  if (visibleProducts.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">محصولی پیدا نشد.</p>;
  }

  return (
    <div>
      {scanStatus && <p className="text-xs text-[var(--color-wine)] mb-2">{scanStatus}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {visibleProducts.map((p, index) => (
          <TrendyolProductCard
            key={p.id}
            p={p}
            index={index}
            onQuickView={setQuickViewProduct}
            isWishlisted={wishlistedIds.has(String(p.id))}
            attrsQuery={activeAttrsQuery}
            minDiscountPercentToShow={minDiscountPercentToShow}
          />
        ))}
      </div>

      {quickViewProduct && (
        <TrendyolQuickView
          initialProduct={quickViewProduct}
          isWishlisted={wishlistedIds.has(String(quickViewProduct.id))}
          onClose={() => setQuickViewProduct(null)}
          minDiscountPercentToShow={minDiscountPercentToShow}
        />
      )}

      {error && (
        <div className="mt-4 text-center">
          <p className="text-sm text-red-600 whitespace-pre-wrap mb-2">{error}</p>
          <button
            type="button"
            onClick={loadMore}
            className="border cut-line rounded-full px-6 py-2 text-sm font-medium hover:border-[var(--color-wine)] cursor-pointer"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {/* سنتینل نامرئی برای تشخیص رسیدن به ته صفحه -- فقط وقتی صفحه‌ی بعدی
          واقعاً وجود داره رندر می‌شه، وگرنه نیازی به observer نیست */}
      {nextUrl && !error && (
        <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-6">
          {loading && (
            <span className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</span>
          )}
        </div>
      )}
    </div>
  );
}

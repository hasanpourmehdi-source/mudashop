import Link from "next/link";
import type { TrendyolCurrentSeller, TrendyolOtherSeller } from "@/lib/trendyolProductDetail";
import { formatTomanOrOriginalCurrency } from "@/lib/exchangeRate";

function ScoreBadge({ score, color }: { score: number | null; color: string | null }) {
  if (score == null) return null;
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
      style={{ backgroundColor: color ?? "#049B24" }}
    >
      {score.toLocaleString("fa-IR")}
    </span>
  );
}

// فقط برای ادمین -- تولتیقِ عدد خامِ لیر، همون امکانی که AddToCartForm/
// TrendyolLiveGrid برای قیمتِ اصلیِ محصول دارن
function liraTitle(lira: number | null | undefined, isAdmin: boolean) {
  return isAdmin && lira != null ? `${lira.toLocaleString("en-US", { maximumFractionDigits: 2 })} TL` : undefined;
}

function PriceBlock({
  price,
  originalPrice,
  priceTL,
  originalPriceTL,
  campaignLabel,
  isAdmin,
}: {
  price: number | null;
  originalPrice: number | null;
  priceTL?: number | null;
  originalPriceTL?: number | null;
  campaignLabel: string | null;
  isAdmin: boolean;
}) {
  if (price == null) return null;
  const formattedPrice = formatTomanOrOriginalCurrency(price, priceTL);
  if (formattedPrice == null) return null;
  const rateNotSet = price <= 0;
  return (
    <div className="flex flex-col items-end gap-0.5">
      {campaignLabel && <span className="text-[9px] font-bold text-[var(--color-ochre)]">{campaignLabel}</span>}
      <div className="flex items-center gap-1.5">
        {rateNotSet && originalPriceTL != null && priceTL != null && originalPriceTL > priceTL && (
          <span className="text-[10px] text-[var(--color-muted)] line-through">
            {Math.round(originalPriceTL).toLocaleString("fa-IR")} لیر
          </span>
        )}
        {!rateNotSet && originalPrice != null && originalPrice > price && (
          <span className="text-[10px] text-[var(--color-muted)] line-through" title={liraTitle(originalPriceTL, isAdmin)}>
            {originalPrice.toLocaleString("fa-IR")}
          </span>
        )}
        <span className="font-bold text-[var(--color-wine)]" title={rateNotSet ? undefined : liraTitle(priceTL, isAdmin)}>
          {formattedPrice}
        </span>
      </div>
    </div>
  );
}

// مقایسه‌ی فروشنده‌ی فعلی با فروشنده‌های دیگه‌ی همین محصول روی ترندیول -- دقیقاً
// عینِ «ÜRÜNÜN DİĞER SATICILARI» خودِ ترندیول: هر کارت فقط اسم+امتیاز+قیمت داره
// (نه سایز، نه دکمه‌ی جدا)، و کلِ کارت کلیک‌پذیره -- کلیک روی یه فروشنده‌ی دیگه
// دوباره همین صفحه‌ی محصول رو با ?merchantId=... باز می‌کنه؛ خودِ صفحه (page.tsx)
// با دیدنِ این پارامتر، قیمت/دکمه‌ی خرید رو از دیدِ همون فروشنده نشون می‌ده --
// هیچ‌وقت به خودِ ترندیول ریدایرکت نمی‌کنیم
export function TrendyolOtherSellers({
  contentId,
  siteSlug,
  currentSeller,
  otherSellers,
  isAdmin = false,
}: {
  contentId: string;
  siteSlug: string;
  currentSeller: TrendyolCurrentSeller | null;
  otherSellers: TrendyolOtherSeller[];
  isAdmin?: boolean;
}) {
  if (otherSellers.length === 0) return null;

  // هیچ‌وقت مستقیم به ترندیول ریدایرکت نمی‌کنیم -- صفحه‌ی فروشگاهِ داخلیِ خودمون
  // (که از قبل توی /marketplaces/[slug]/store/[merchantId] ساخته شده و کامل
  // سمتِ سرورِ خودمون اطلاعاتِ فروشنده رو نشون می‌ده) رو لینک می‌کنیم
  const sellerStoreHref = (merchantId: number) => `/marketplaces/${siteSlug}/store/${merchantId}`;
  const sellerProductHref = (merchantId: number) => `/products/trendyol/${contentId}?merchantId=${merchantId}`;

  return (
    <div className="mt-3 border cut-line rounded-lg p-3 bg-white text-sm space-y-2">
      {currentSeller && (
        <div className="flex items-center justify-between pb-2 border-b cut-line gap-2">
          <div className="min-w-0">
            <Link
              href={sellerStoreHref(currentSeller.merchantId)}
              dir="ltr"
              className="block text-left text-xs font-bold whitespace-nowrap hover:underline"
            >
              {currentSeller.name}
            </Link>
            <ScoreBadge score={currentSeller.score} color={currentSeller.scoreColor} />
          </div>
          <span className="text-[10px] text-[var(--color-muted)] shrink-0">فروشنده‌ی فعلی</span>
        </div>
      )}

      <p className="text-xs font-medium">فروشنده‌های دیگرِ این محصول</p>
      <div className="space-y-2">
        {otherSellers.map((s) => (
          <Link
            key={s.merchantId}
            href={sellerProductHref(s.merchantId)}
            className="flex items-center justify-between gap-2 text-xs bg-[var(--color-linen-dim)]/40 hover:bg-[var(--color-linen-dim)] transition-colors rounded-lg px-2.5 py-2"
          >
            <div className="min-w-0">
              <span dir="ltr" className="block text-left font-medium whitespace-nowrap text-[var(--color-wine)]">
                {s.name}
              </span>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <ScoreBadge score={s.score} color={s.scoreColor} />
                {!s.inStock && (
                  <span className="text-[10px] text-red-600 bg-red-50 rounded px-1.5 py-0.5">ناموجود</span>
                )}
              </div>
            </div>
            <PriceBlock
              price={s.price}
              originalPrice={s.originalPrice}
              priceTL={s.priceTL}
              originalPriceTL={s.originalPriceTL}
              campaignLabel={s.campaignLabel}
              isAdmin={isAdmin}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

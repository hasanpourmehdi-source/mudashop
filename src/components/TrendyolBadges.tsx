// کامپوننت‌ها و نگاشت‌های مشترک بین نمایش‌های مختلف محصولات ترندیول (کارت گرید،
// نگاه سریع، محصولات مشابه) -- توی یه فایل جدا نگه داشته می‌شن (نه داخل خودِ
// TrendyolLiveGrid.tsx) که وارد کردنشون از TrendyolQuickView.tsx باعث
// import چرخه‌ای (TrendyolLiveGrid <-> TrendyolQuickView) نشه، چون
// TrendyolLiveGrid خودش TrendyolQuickView رو رندر می‌کنه.

// اعداد لاتین (رتبه‌ی توی title بج‌ها، مثل "1") رو به فارسی تبدیل می‌کنه
export function toPersianDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

// انواع بج نواری که title‌شون یه عدد رتبه‌ست (نه متن) -- طبق ترجمه‌های واقعی
// ترندیول (best_seller-strip-badge: "En Çok Satan {count}. Ürün" و مشابهش
// برای بقیه) با {count} جایگزین می‌شه
const STRIP_BADGE_RANKED_LABELS: Record<string, string> = {
  BEST_SELLER: "پرفروش‌ترین #{count}",
  TOP_VIEWED: "پربازدیدترین #{count}",
  MOST_RATED: "بیشترین امتیاز #{count}",
  MOST_FAVOURITE: "محبوب‌ترین #{count}",
};

// انواعی که title‌شون خودش متن نمایشیه (نه عدد رتبه) -- مستقیم از داده‌ی خام
// واقعی ترندیول تأیید شده
const STRIP_BADGE_DIRECT_LABELS: Record<string, string> = {
  SUCCESSFUL_SELLER: "فروشنده‌ی موفق",
  AUTHORIZED_SELLER: "فروشنده‌ی مجاز",
  PICKED_BY_INFLUENCER: "انتخاب اینفلوئنسر",
  CROSS_PROMOTION: "با هم بخر، ببر",
};

export function getStripBadgeLabel(type: string, title: string): string | null {
  const rankedTemplate = STRIP_BADGE_RANKED_LABELS[type];
  if (rankedTemplate) return rankedTemplate.replace("{count}", toPersianDigits(title));
  return STRIP_BADGE_DIRECT_LABELS[type] ?? null;
}

// ۵ ستاره‌ی گرافیکی که به نسبت rating (۰ تا ۵) پر می‌شن -- به‌جای یه ستاره‌ی
// تکی + عدد، دقیقاً مثل ردیف ستاره‌های ترندیول. با overlay دو لایه (خاکستری
// کامل زیر، رنگی روی با width درصدی) پیاده شده -- ساده‌ترین راه برای نصفه‌ستاره
export function StarRating({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <span className="relative inline-flex text-[11px] leading-none" dir="ltr">
      <span className="flex gap-[1px] text-[var(--color-line)]">{"★★★★★"}</span>
      <span
        className="absolute inset-0 flex gap-[1px] text-[var(--color-ochre)] overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
      >
        {"★★★★★"}
      </span>
    </span>
  );
}

// تیک آبی «فروشنده‌ی رسمی» -- شبیه بج تاییدشده‌ی توییتر/اینستاگرام (دایره‌ی
// آبی با تیک سفید)، به‌جای یه ✓ ساده‌ی رنگی که واقعاً شبیه بج تاییدیه نبود
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#1DA1F2"
        d="M12 2 14.4 4.1 17.6 3.5 18.6 6.6 21.5 8.2 20.4 11.4 21.5 14.6 18.6 16.2 17.6 19.3 14.4 18.7 12 20.8 9.6 18.7 6.4 19.3 5.4 16.2 2.5 14.6 3.6 11.4 2.5 8.2 5.4 6.6 6.4 3.5 9.6 4.1Z"
      />
      <path
        d="M9.5 12.5l1.8 1.8 3.6-4.1"
        stroke="white"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// آیکون چشم برای دکمه‌ی «نگاه سریع» -- به‌جای ایموجی 👁 که روی بعضی سیستم‌ها
// (مخصوصاً ویندوز/کروم) اصلاً رندر نمی‌شه یا خالی نشون داده می‌شه
export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { internalTrendyolProductHref } from "@/lib/trendyolProductLink";

export { extractSeoSlugFromUrl, internalTrendyolProductHref } from "@/lib/trendyolProductLink";

// لینکی که قبل از ناوبری، آدرس کامل trendyol.com رو کش می‌کنه -- برای هر
// جایی که به یه محصول ترندیول لینک می‌دیم (کارت گرید، انتخاب رنگ، محصولات
// مشابه، ...) باید از همین استفاده بشه، وگرنه صفحه‌ی جزئیات کش خالی می‌بینه
// و 404 می‌ده. preventDefault + ناوبری دستی لازمه چون وگرنه مرورگر همزمان با
// اجرای fetch شروع به ناوبری می‌کنه (race condition).
export function TrendyolProductLink({
  contentId,
  trendyolUrl,
  className,
  title,
  children,
  attrsQuery,
}: {
  contentId: string | number;
  trendyolUrl: string | null | undefined;
  className?: string;
  title?: string;
  children: React.ReactNode;
  // فیلتر ویژگی فعلاً فعال روی صفحه‌ی لیست (مثلاً "Beden~40") -- اگه موجود باشه،
  // همراه لینک می‌ره تا از قبل روی صفحه‌ی محصول انتخاب شده باشه
  attrsQuery?: string;
}) {
  const router = useRouter();
  const href = internalTrendyolProductHref(contentId, trendyolUrl, attrsQuery);

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // کلیک وسط/ctrl/cmd (باز کردن در تب جدید) رو دست‌نخورده بذار
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();

    if (trendyolUrl) {
      try {
        await fetch("/api/trendyol/cache-product-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId: String(contentId), url: trendyolUrl }),
        });
      } catch {
        // خطای شبکه اینجا مهم نیست -- بازم به صفحه می‌ریم، صفحه‌ی جزئیات
        // خودش notFound می‌زنه اگه کش نشده باشه
      }
    }

    router.push(href);
  }

  return (
    <a href={href} onClick={handleClick} className={className} title={title}>
      {children}
    </a>
  );
}

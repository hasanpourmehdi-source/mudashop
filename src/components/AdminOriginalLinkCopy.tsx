"use client";

import { useState } from "react";

// فقط برای ادمین -- لینک اصلی محصول روی ترندیول (برای وقتی نیاز به بررسی
// دستی/ارجاع به منبع اصلی هست) + دکمه‌ی مستقیم به ابزار «پوستر اینستاگرام»
// همین محصول، دقیقاً کنار عنوان اصلی (AdminOriginalTitleCopy). عمداً هر دو
// <button> هستن نه <Link> -- چون این کامپوننت گاهی داخلِ یه <a> دیگه (کارتِ
// گرید توی TrendyolLiveGrid) رندر می‌شه و <a> تودرتو نامعتبره/باگ‌داره.
// alwaysVisible=false یعنی مثل AdminOriginalTitleCopy فقط با هاور روی کارت
// (کلاس group روی والد) دیده می‌شه -- توی گرید که چندین لینکِ ادمین کنار هم
// می‌آد، این‌طوری شلوغ نمی‌شه
export function AdminOriginalLinkCopy({
  url,
  isAdmin,
  alwaysVisible = true,
}: {
  url: string;
  isAdmin: boolean;
  alwaysVisible?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!isAdmin || !url) return null;

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // بی‌اهمیت -- لینک با title بومی مرورگر هم قابل مشاهده/کپیِ دستی‌ست
    }
  }

  function handlePosterClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.open(`/admin/poster-generator?input=${encodeURIComponent(url)}`, "_blank");
  }

  return (
    <span
      className={`inline-flex items-center gap-2 transition-opacity ${
        alwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
      }`}
    >
      <button
        type="button"
        onClick={handleCopy}
        title={url}
        dir="ltr"
        className="inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-wine)] shrink-0"
      >
        {copied ? "کپی شد ✓" : "🔗 لینک اصلی ترندیول (ادمین)"}
      </button>
      <button
        type="button"
        onClick={handlePosterClick}
        className="inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-wine)] shrink-0"
      >
        📷 ساخت پست اینستاگرام
      </button>
    </span>
  );
}

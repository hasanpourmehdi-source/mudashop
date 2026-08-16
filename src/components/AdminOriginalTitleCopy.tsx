"use client";

import { useEffect, useState } from "react";

// فقط برای ادمین -- وقتی روی کارت/عنوان محصول (که کانتینرش کلاس group داره)
// هاور می‌کنی، این دکمه‌ی کوچیک ظاهر می‌شه؛ عنوان اصلیِ ترکی (قبل از ترجمه) رو
// هم با موس‌آوردن (title بومی مرورگر) نشون می‌ده هم با کلیک کپی می‌کنه -- تا
// وقتی ترجمه‌ی یه عنوان ایراد داشت، ادمین راحت متن اصلی رو برداره ببره توی
// دیکشنری. برای غیرادمین اصلاً رندر نمی‌شه.
export function AdminOriginalTitleCopy({
  originalTitle,
  isAdmin,
  alwaysVisible,
}: {
  originalTitle: string;
  isAdmin: boolean;
  // توی گرید (کارت‌های تکرارشونده) بهتره فقط موقع هاور روی کارت (کلاس group
  // روی والد) دیده بشه تا شلوغ نشه؛ توی صفحه‌ی جزئیات/نگاه سریع که فقط یه
  // عنوان روی صفحه‌ست، همیشه نشونش بده
  alwaysVisible?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [unknownTerms, setUnknownTerms] = useState<string[] | null>(null);

  // چک زنده‌ی کلمات ناشناخته -- فقط برای ادمین، فقط همین یه بار موقع mount؛
  // این‌طوری بدون این‌که مسیر داده‌ی محصولات (که بین مشتری/ادمین مشترکه) رو
  // برای این ویژگیِ صرفاً ادمینی دست بزنیم، ادمین مستقیم توی هاور می‌بینه چی
  // رو باید به دیکشنری اضافه کنه
  useEffect(() => {
    if (!isAdmin || !originalTitle) return;
    let cancelled = false;
    fetch(`/api/admin/trendyol-title-dictionary/check-title?title=${encodeURIComponent(originalTitle)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUnknownTerms(Array.isArray(data.unknownTerms) ? data.unknownTerms : []);
      })
      .catch(() => {
        if (!cancelled) setUnknownTerms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, originalTitle]);

  if (!isAdmin) return null;

  async function handleCopy(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(originalTitle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      return;
    } catch {
      // fallback قدیمی‌تر برای مرورگرهایی که Clipboard API رو رد می‌کنن
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = originalTitle;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      }
    } catch {
      // ادامه به شاخه‌ی خطا پایین
    }
    // هیچ‌کدوم کار نکرد -- حداقل با یه پیام روشن بگو، نه این‌که دکمه بی‌صدا
    // هیچ کاری نکنه؛ خودِ title بومی (هاور) هنوز متن اصلی رو نشون می‌ده تا
    // دستی انتخاب/کپی بشه
    setCopyError(true);
    setTimeout(() => setCopyError(false), 2500);
  }

  const tooltip =
    unknownTerms && unknownTerms.length > 0
      ? `${originalTitle}\n\nکلمات ترجمه‌نشده: ${unknownTerms.join("، ")}`
      : originalTitle;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={tooltip}
      dir="ltr"
      className={`${
        alwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
      } transition-opacity inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-wine)] shrink-0`}
    >
      {copied ? "کپی شد ✓" : copyError ? "کپی خودکار ممکن نشد -- با هاور متن رو ببین" : "🔎 عنوان اصلی (ادمین)"}
    </button>
  );
}

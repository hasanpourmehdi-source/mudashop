"use client";

import { useEffect, useState } from "react";
import { TranslatableRun } from "@/components/AdminClickToTranslate";
import { requestCheckTitle } from "@/lib/checkTitleBatcher";

// فقط برای ادمین -- وقتی روی کارت/عنوان محصول (که کانتینرش کلاس group داره)
// هاور می‌کنی، این دکمه‌ی کوچیک ظاهر می‌شه؛ عنوان اصلیِ ترکی (قبل از ترجمه) رو
// هم با موس‌آوردن (title بومی مرورگر) نشون می‌ده هم با کلیک کپی می‌کنه -- تا
// وقتی ترجمه‌ی یه عنوان ایراد داشت، ادمین راحت متن اصلی رو برداره ببره توی
// دیکشنری. برای غیرادمین اصلاً رندر نمی‌شه.
export function AdminOriginalTitleCopy({
  originalTitle,
  isAdmin,
  alwaysVisible,
  brand,
}: {
  originalTitle: string;
  isAdmin: boolean;
  // توی گرید (کارت‌های تکرارشونده) بهتره فقط موقع هاور روی کارت (کلاس group
  // روی والد) دیده بشه تا شلوغ نشه؛ توی صفحه‌ی جزئیات/نگاه سریع که فقط یه
  // عنوان روی صفحه‌ست، همیشه نشونش بده
  // روی دستگاه‌های بدون ماوس (موبایل/PWA) هاور معنی نداره، پس صرف‌نظر از
  // alwaysVisible همیشه نشون داده می‌شه -- وگرنه ادمینِ موبایلی هیچ‌وقت
  // بهش دسترسی نداشت
  alwaysVisible?: boolean;
  // اسمِ برندِ همین محصول (اگه معلوم باشه) -- اسمِ خاصه، نه اصطلاحِ مد ترکی، و
  // اصلاً توی عنوانِ نمایشی هم تکرار نمی‌شه (جدا بالای عنوان نشون داده می‌شه)،
  // پس نباید به‌عنوانِ «کلمه‌ی ترجمه‌نشده» به ادمین پیشنهاد بشه که به دیکشنریِ
  // مشترک اضافه‌ش کنه -- همون منطقی که خودِ tokenizeAndTranslate برای عنوانِ
  // نمایشی داره، اینجا هم برای چکِ زنده‌ی کلماتِ ناشناخته اعمال می‌شه
  brand?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [unknownTerms, setUnknownTerms] = useState<string[] | null>(null);

  // چک زنده‌ی کلمات ناشناخته -- فقط برای ادمین، فقط همین یه بار موقع mount؛
  // این‌طوری بدون این‌که مسیر داده‌ی محصولات (که بین مشتری/ادمین مشترکه) رو
  // برای این ویژگیِ صرفاً ادمینی دست بزنیم، ادمین مستقیم توی هاور می‌بینه چی
  // رو باید به دیکشنری اضافه کنه. به‌جای فچِ مستقیم (که توی صفحه‌ای با صدها
  // کارت یعنی صدها فچِ هم‌زمان)، از یه batcherِ مشترک استفاده می‌شه که
  // درخواست‌های همون بازه‌ی کوتاه رو جمع و یکجا می‌فرسته -- ببین
  // src/lib/checkTitleBatcher.ts
  useEffect(() => {
    if (!isAdmin || !originalTitle) return;
    return requestCheckTitle(originalTitle, brand ?? null, setUnknownTerms);
  }, [isAdmin, originalTitle, brand]);

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
    <span
      className={`${
        alwaysVisible
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"
      } transition-opacity inline-flex items-center gap-1.5 flex-wrap`}
    >
      <button
        type="button"
        onClick={handleCopy}
        title={tooltip}
        dir="ltr"
        className="inline-flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-wine)] text-start"
      >
        <span className="shrink-0">🔎</span>
        {/* عمداً فقط یه برچسبِ کوتاهه، نه خودِ متنِ کاملِ عنوان (که قبلاً امتحان
            شد ولی طبقِ درخواستِ صریح برگردونده شد) -- خودِ عنوان با کلیک
            مستقیم توی کلیپ‌بورد کپی می‌شه، یا با هاور (native title) دیده می‌شه */}
        <span>
          {copied ? "کپی شد ✓" : copyError ? "کپی خودکار ممکن نشد -- با هاور متن رو ببین" : "کپیِ عنوانِ اصلی"}
        </span>
      </button>
      {/* کلماتی که دیکشنری/فرمول‌ها نتونستن ترجمه کنن، اصلاً توی عنوانِ نمایشی
          نمیان (طبق تصمیمِ tokenizeAndTranslate: فقط کلماتِ ترجمه‌شده نشون داده
          می‌شن) -- پس تنها راهِ ادمین برای ترجمه‌شون، همین‌جا (نه خودِ عنوان) است */}
      {unknownTerms && unknownTerms.length > 0 && (
        <span className="inline-flex items-center gap-1 flex-wrap text-[10px]" dir="ltr">
          {unknownTerms.map((term) => (
            <TranslatableRun
              key={term}
              displayText={term}
              coreWords={[term]}
              onSaved={() => setUnknownTerms((prev) => (prev ?? []).filter((t) => t !== term))}
            />
          ))}
        </span>
      )}
    </span>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AdminClickToTranslate, extractUniqueWords } from "@/components/AdminClickToTranslate";

// کلماتِ رویِ پوستر (دسته‌بندی/مقادیرِ ویژگی‌ها/کلماتِ عنوان) -- هم لاتینِ
// ترجمه‌نشده (که فقط با کلیک می‌شه به دیکشنری اضافه‌ش کرد) هم فارسیِ از‌قبل‌ترجمه‌شده
// (که ممکنه ترجمه‌ش غلط/بی‌مزه باشه و ادمین بخواد اصلاحش کنه، مثلِ «uzun» که به‌جایِ
// «بلند» به «دراز» ترجمه شده بود) -- هردو همین‌جا، بدونِ رفتن به صفحه‌ی جداگانه‌ی
// دیکشنری، قابلِ افزودن/ویرایش/حذف‌ان (AdminClickToTranslate خودش تشخیص می‌ده
// کدوم کلمه لاتینه/کدوم فارسی و فرمِ مناسب رو باز می‌کنه)
//
// عمداً از check-title استفاده نمی‌کنیم: اون endpoint فرض می‌کنه کل ورودی
// عنوانِ خامِ ترکیه (و هر توکنی که توی دیکشنری نباشه رو «ناشناخته» می‌گیره) --
// ولی detail.categoryName/attributes/nameFa از قبل توسطِ خودِ سرور ترجمه شدن
// (فقط کلماتِ ناشناخته‌شون خام باقی موندن)؛ اگه این متنِ نیمه‌ترجمه‌شده رو
// دوباره به check-title بدیم، کلماتِ فارسیِ از‌قبل‌درستِ توش هم به‌غلط
// «ناشناخته» حساب می‌شن.
export function PosterUntranslatedTerms({
  checkText,
  onTranslated,
}: {
  checkText: string;
  // بعدِ ذخیره/ویرایش/حذفِ موفقِ هر ترجمه صدا زده می‌شه -- برای بارگذاریِ دوباره‌ی
  // جزئیاتِ محصول (تا خودِ پوستر هم فوراً با ترجمه‌ی تازه رندر بشه، نه فقط لیستِ اینجا)
  onTranslated: () => void;
}) {
  const terms = useMemo(() => extractUniqueWords(checkText), [checkText]);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = terms.filter((t) => !dismissed.has(t));

  if (visible.length === 0) return null;

  return (
    <div className="border cut-line rounded-xl p-3 bg-amber-50 space-y-2">
      <p className="text-xs font-bold text-amber-800">
        کلماتِ رویِ پوستر -- روی هرکدوم بزن تا ترجمه‌ش رو اضافه/اصلاح/حذف کنی (بدونِ رفتن به دیکشنری)
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm" dir="ltr">
        {visible.map((term) => (
          <span key={term} dir="auto">
            <AdminClickToTranslate
              text={term}
              isAdmin
              onSaved={() => {
                setDismissed((prev) => new Set(prev).add(term));
                onTranslated();
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

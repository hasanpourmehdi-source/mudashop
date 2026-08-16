"use client";

import { useEffect } from "react";

// پیام‌های پیش‌فرض اعتبارسنجی مرورگر (مثل "Please fill out this field") بر اساس
// زبان سیستم/مرورگر کاربر نمایش داده می‌شن، نه زبان صفحه -- این کامپوننت با گوش دادن
// به رویداد "invalid" روی کل سند، اون پیام‌ها رو با فارسی جایگزین می‌کنه.
//
// همه‌ی متن‌ها همین‌جا جمع شدن -- اگه بعداً سایت دوزبانه شد، فقط کافیه همین چند خط
// رو به یه تابع ترجمه (مثلا t()) وصل کنیم، بقیه‌ی فرم‌ها دست‌نخورده می‌مونن.
function persianValidationMessage(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const v = target.validity;

  if (v.valueMissing) return "لطفاً این فیلد را پر کنید";
  if (v.typeMismatch) {
    if ("type" in target && target.type === "email") return "لطفاً یک ایمیل معتبر وارد کنید";
    if ("type" in target && target.type === "url") return "لطفاً یک آدرس معتبر وارد کنید";
    return "قالب واردشده معتبر نیست";
  }
  if (v.tooShort) return `حداقل باید ${(target as HTMLInputElement).minLength} کاراکتر وارد کنید`;
  if (v.tooLong) return `حداکثر ${(target as HTMLInputElement).maxLength} کاراکتر مجاز است`;
  if (v.rangeUnderflow) return `مقدار باید حداقل ${(target as HTMLInputElement).min} باشد`;
  if (v.rangeOverflow) return `مقدار باید حداکثر ${(target as HTMLInputElement).max} باشد`;
  if (v.stepMismatch) return "مقدار واردشده معتبر نیست";
  if (v.patternMismatch) return "قالب واردشده معتبر نیست";
  if (v.badInput) return "مقدار واردشده قابل قبول نیست";

  return "این مقدار معتبر نیست";
}

export function FormValidationLocalizer() {
  useEffect(() => {
    function handleInvalid(e: Event) {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (!target || !("validity" in target)) return;
      target.setCustomValidity(persianValidationMessage(target));
    }

    function clearCustomValidity(e: Event) {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (target && "setCustomValidity" in target) target.setCustomValidity("");
    }

    // "invalid" bubble نمی‌کنه، پس باید توی فاز capture گوش بدیم تا رو کل سند کار کنه
    document.addEventListener("invalid", handleInvalid, true);
    // با شروع دوباره‌ی تایپ، پیام سفارشی پاک بشه تا اعتبارسنجی دوباره طبیعی چک بشه
    document.addEventListener("input", clearCustomValidity, true);
    document.addEventListener("change", clearCustomValidity, true);

    return () => {
      document.removeEventListener("invalid", handleInvalid, true);
      document.removeEventListener("input", clearCustomValidity, true);
      document.removeEventListener("change", clearCustomValidity, true);
    };
  }, []);

  return null;
}

"use client";

// اعداد فارسی رو به انگلیسی تبدیل می‌کنه تا هر جوری کاربر تایپ کنه، درست پارس بشه
function toEnglishDigits(str: string): string {
  return str.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

export function CurrencyInput({
  value,
  onChange,
  placeholder,
  className,
  allowNegative = false,
  required,
}: {
  value: string; // مقدار خام (فقط رقم، بدون جداکننده) -- همون چیزی که با Number() تبدیل می‌شه
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowNegative?: boolean; // برای فیلدهایی مثل «اختلاف قیمت» که می‌تونن منفی باشن
  required?: boolean;
}) {
  function format(raw: string): string {
    const negative = allowNegative && raw.trim().startsWith("-");
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits) return negative ? "-" : "";
    const formatted = Number(digits).toLocaleString("fa-IR");
    return negative ? `-${formatted}` : formatted;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const converted = toEnglishDigits(e.target.value);
    const negative = allowNegative && converted.trim().startsWith("-");
    const digits = converted.replace(/[^\d]/g, "");
    onChange(negative && digits ? `-${digits}` : digits);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      required={required}
      value={format(value)}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}

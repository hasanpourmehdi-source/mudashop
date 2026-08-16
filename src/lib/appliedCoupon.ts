// کد تخفیفی که توی صفحه‌ی سبد اعمال شده -- فقط خودِ کد رو نگه می‌داریم (نه نتیجه‌ی
// اعتبارسنجی)، چون صفحه‌ی چک‌اوت خودش دوباره از سرور اعتبارسنجیش می‌کنه (ممکنه بین
// این دو صفحه منقضی/غیرفعال شده باشه)
const KEY = "mudashop-applied-coupon";

export function getAppliedCouponCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY) ?? "";
}

export function setAppliedCouponCode(code: string): void {
  if (typeof window === "undefined") return;
  if (code) localStorage.setItem(KEY, code);
  else localStorage.removeItem(KEY);
}

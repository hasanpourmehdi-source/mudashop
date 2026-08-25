// وضعیتِ رضایتِ کوکیِ تبلیغاتی (GA4/متا پیکسل) -- سمتِ کلاینت، localStorage.
// هیچ ربطی به کوکی‌های ضروریِ خودِ سایت (لاگین، سبد خرید) نداره -- اون‌ها
// همیشه کار می‌کنن، این فقط برای اسکریپت‌های تبلیغاتیِ اختیاریه.
export const COOKIE_CONSENT_KEY = "mudashop_cookie_consent";
export type CookieConsent = "accepted" | "rejected" | null;

export function getCookieConsent(): CookieConsent {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(COOKIE_CONSENT_KEY);
  return v === "accepted" || v === "rejected" ? v : null;
}

export function setCookieConsent(value: "accepted" | "rejected"): void {
  localStorage.setItem(COOKIE_CONSENT_KEY, value);
}

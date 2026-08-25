// ابزارهای سئو -- آدرس پایه، توضیحات، قیمت فارسی (همه خالص و تست‌پذیر)

// دامنه‌ی واقعی سایت از env می‌آید؛ در توسعه/تست به localhost برمی‌گردد
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// ساخت آدرس مطلق از یک مسیر نسبی
export function siteUrl(path = ""): string {
  if (!path) return SITE_URL;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

// تبدیل متن توضیح (که ممکن است خام و طولانی باشد) به description مناسب متا
export function toMetaDescription(text: string | undefined, max = 155): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

// قیمت به فارسی: "۱۲۰٬۰۰۰ تومان"
export function priceFa(amount: number | undefined): string {
  if (amount === undefined || amount === null) return "";
  return `${amount.toLocaleString("fa-IR")} تومان`;
}
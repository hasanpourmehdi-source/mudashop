import sanitizeHtml from "sanitize-html";

// ================= توضیحاتِ محصول (متنِ فرمت‌بندی‌شده) =================
// فقط تگ‌های سادهِ متنی -- بدونِ لینک/عکس/اسکریپت/استایل/attribute. هم موقعِ
// ذخیره (ورودیِ خامِ ادمین) هم موقعِ نمایش (دفاع در عمق + سازگاری با
// توضیحاتِ قدیمی‌تری که هنوز متنِ خامن، نه HTML) استفاده می‌شه. div هم مجازه
// چون contentEditable مرورگرها (خصوصاً Chrome) گاهی به‌جای <p> از <div> برای
// خطِ جدید استفاده می‌کنن -- اگه مجاز نبود، خودِ خطوط (نه فقط تگش) پاک می‌شد
const ALLOWED_TAGS = ["p", "div", "br", "b", "strong", "i", "em", "ul", "ol", "li"];

export function sanitizeProductDescription(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
  });
}

// برای جاهایی که فقط متنِ خام لازمه، نه HTML -- توضیحِ متا/JSON-LD/امتیازِ
// جست‌وجوی فازی، جایی که تگ‌های HTML صرفاً نویز حساب می‌شن
export function stripHtmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}

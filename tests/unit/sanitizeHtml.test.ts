import { describe, expect, it } from "vitest";
import { sanitizeProductDescription, stripHtmlToText } from "@/lib/sanitizeHtml";

describe("sanitizeProductDescription -- توضیحاتِ محصول با فرمت‌بندیِ امن", () => {
  it("تگ‌های مجاز (پررنگ/لیست/پاراگراف) رو دست‌نخورده نگه می‌داره", () => {
    const html = "<p>سلام <b>دنیا</b></p><ul><li>یک</li><li>دو</li></ul>";
    expect(sanitizeProductDescription(html)).toBe(html);
  });

  it("اسکریپت/تگ‌های خطرناک رو کامل حذف می‌کند (نه فقط escape)", () => {
    const html = "<p>متن</p><script>alert(1)</script>";
    const result = sanitizeProductDescription(html);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("<p>متن</p>");
  });

  it("رویدادهای inline (onerror و مشابه) حذف می‌شن حتی روی تگِ مجاز", () => {
    const html = '<p onclick="alert(1)">متن</p><img src=x onerror="alert(2)">';
    const result = sanitizeProductDescription(html);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("<img");
  });

  it("لینک/عکس (خارج از allow-list) حذف می‌شن، متنِ داخلشون می‌مونه", () => {
    const html = '<p>ببین <a href="https://evil.com">اینجا</a></p>';
    const result = sanitizeProductDescription(html);
    expect(result).not.toContain("<a");
    expect(result).toContain("اینجا");
  });

  it("متنِ خامِ بدونِ هیچ تگی (توضیحاتِ قدیمی) دست‌نخورده می‌مونه", () => {
    expect(sanitizeProductDescription("یه توضیحِ ساده")).toBe("یه توضیحِ ساده");
  });
});

describe("stripHtmlToText -- برای متا/JSON-LD/جست‌وجوی فازی", () => {
  it("همه‌ی تگ‌ها رو حذف می‌کند، فقط متن می‌ماند", () => {
    expect(stripHtmlToText("<p>سلام <b>دنیا</b></p><ul><li>یک</li></ul>")).toBe("سلام دنیایک");
  });

  it("اسکریپت رو هم کامل (تگ و محتوا) حذف می‌کند", () => {
    expect(stripHtmlToText("<p>متن</p><script>alert(1)</script>")).toBe("متن");
  });

  it("متنِ خام بدونِ تگ دست‌نخورده می‌ماند", () => {
    expect(stripHtmlToText("یه توضیحِ ساده")).toBe("یه توضیحِ ساده");
  });
});

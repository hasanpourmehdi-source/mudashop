import { describe, expect, it } from "vitest";
import { normalizeSlug } from "@/lib/slug";

// حروف عربی با کد یونیکد متفاوت (ي U+064A / ك U+0643) باید به فارسی (ی U+06CC / ک U+06A9) نگاشت بشن
const ARABIC_YEH_WORD = "\u067E\u064A\u0631\u0627\u0647\u0646"; // پيراهن (ي عربی)
const PERSIAN_YEH_WORD = "\u067E\u06CC\u0631\u0627\u0647\u0646"; // پیراهن (ی فارسی)
const ARABIC_KEHEH_BAG = "\u0643\u064A\u0641"; // كيف (ك عربی)
const PERSIAN_KEHEH_BAG = "\u06A9\u06CC\u0641"; // کیف (ک فارسی)

describe("normalizeSlug", () => {
  it("ي عربی و ك عربی به معادل فارسی تبدیل می‌شوند", () => {
    expect(normalizeSlug(ARABIC_YEH_WORD)).toBe(PERSIAN_YEH_WORD);
    expect(normalizeSlug(ARABIC_KEHEH_BAG)).toBe(PERSIAN_KEHEH_BAG);
  });

  it("متن فارسی سالم دست‌نخورده می‌ماند", () => {
    expect(normalizeSlug(PERSIAN_YEH_WORD)).toBe(PERSIAN_YEH_WORD);
  });

  it("فضاهای اطراف حذف می‌شوند", () => {
    expect(normalizeSlug("  پوشاک  ")).toBe("پوشاک");
  });

  it("اسلاگ لاتین تغییری نمی‌کند", () => {
    expect(normalizeSlug("classic-linen-shirt")).toBe("classic-linen-shirt");
  });
});
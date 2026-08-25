import { describe, expect, it } from "vitest";
import {
  isGenderTurkishSection,
  TRENDYOL_TOP_SECTIONS,
  turkishSectionForFa,
} from "@/lib/trendyolTopSections";

describe("TRENDYOL_TOP_SECTIONS -- ساختار داده‌ی ثابت نوار ناوبری", () => {
  it("دقیقاً ۱۰ بخش دارد: ۲ جنسیتی (بدون rootWc) + ۸ غیرجنسیتی با rootWc=...", () => {
    expect(TRENDYOL_TOP_SECTIONS).toHaveLength(10);

    const gender = TRENDYOL_TOP_SECTIONS.filter((s) => s.isGenderSection);
    const nonGender = TRENDYOL_TOP_SECTIONS.filter((s) => !s.isGenderSection);

    expect(gender.map((s) => s.turkish)).toEqual(["Kadın", "Erkek"]);
    for (const s of gender) expect(s.rootWc).toBeNull();

    expect(nonGender).toHaveLength(8);
    for (const s of nonGender) {
      expect(s.rootWc, s.turkish).toMatch(/^wc=/);
      expect(s.fa).toBeTruthy();
    }
  });

  it("هیچ نام ترکی/فارسی تکراری ندارد", () => {
    const turkish = TRENDYOL_TOP_SECTIONS.map((s) => s.turkish);
    const fa = TRENDYOL_TOP_SECTIONS.map((s) => s.fa);
    expect(new Set(turkish).size).toBe(turkish.length);
    expect(new Set(fa).size).toBe(fa.length);
  });

  it("برچسب‌های فارسی کاملاً فارسی‌اند و punk مثل هم‌نه نجومی ندارند", () => {
    const ok = TRENDYOL_TOP_SECTIONS.every((s) => /[\u0600-\u06FF]/.test(s.fa));
    expect(ok).toBe(true);
  });
});

describe("turkishSectionForFa", () => {
  it("نگاشت فارسی به ترکی را برمی‌گرداند", () => {
    expect(turkishSectionForFa("زنانه")).toBe("Kadın");
    expect(turkishSectionForFa("سوپرمارکت")).toBe("Süpermarket");
    expect(turkishSectionForFa("ورزش و فضای باز")).toBe("Spor & Outdoor");
  });

  it("برای مقدار ناشناخته null برمی‌گرداند", () => {
    expect(turkishSectionForFa("بهداشت")).toBeNull();
    expect(turkishSectionForFa("")).toBeNull();
  });
});

describe("isGenderTurkishSection", () => {
  it("فقط Kadın/Erkek جنسیتی‌اند", () => {
    expect(isGenderTurkishSection("Kadın")).toBe(true);
    expect(isGenderTurkishSection("Erkek")).toBe(true);
    expect(isGenderTurkishSection("Electronik")).toBe(false);
    expect(isGenderTurkishSection("Kozmetik")).toBe(false);
    expect(isGenderTurkishSection("nonexistent")).toBe(false);
  });
});
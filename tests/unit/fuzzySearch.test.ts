import { describe, expect, it } from "vitest";
import { levenshtein, fuzzyWordMatch, fuzzyTextMatch } from "@/lib/fuzzySearch";

describe("levenshtein", () => {
  it("رشته‌های یکسان فاصله صفر دارند", () => {
    expect(levenshtein("کتاب", "کتاب")).toBe(0);
  });

  it("رشته خالی: طول رشته دیگر", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });

  it("جابه‌جایی، درج و حذف را محاسبه می‌کند", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("fuzzyWordMatch", () => {
  it("query کوتاه (تک‌حرفی) substring می‌خواهد", () => {
    expect(fuzzyWordMatch("ک", ["کتاب"])).toBe(true);
    expect(fuzzyWordMatch("س", ["کتاب"])).toBe(false);
  });

  it("substring معمولی قبول است", () => {
    expect(fuzzyWordMatch("تاب", ["کتاب"])).toBe(true);
  });

  it("غلط تایپی نیم‌حرفی قبول است", () => {
    expect(fuzzyWordMatch("کتا", ["کتاب"])).toBe(true);
  });

  it("تفاوت زیاد رد می‌شود", () => {
    expect(fuzzyWordMatch("درخت", ["کتاب"])).toBe(false);
  });

  it("کلمه بلندتر تا ۲ خطا قبول می‌کند", () => {
    expect(fuzzyWordMatch("کتابخانه", ["کتابخانه"])).toBe(true);
    expect(fuzzyWordMatch("کتابخانر", ["کتابخانه"])).toBe(true);
  });
});

describe("fuzzyTextMatch", () => {
  it("با query خالی همیشه true است", () => {
    expect(fuzzyTextMatch("", "هر متنی")).toBe(true);
  });

  it("همه کلمات باید فازی در متن باشند", () => {
    expect(fuzzyTextMatch("کتاب قرمز", "کتاب قرمز قیمت دار")).toBe(true);
  });

  it("اگر یک کلمه پیدا نشود، false است", () => {
    expect(fuzzyTextMatch("کتاب سبز", "کتاب قرمز")).toBe(false);
  });

  it("به بزرگی/کوچکی حروف حساس نیست", () => {
    expect(fuzzyTextMatch("MTV", "my mtv and tv")).toBe(true);
  });

  it("با غلط تایپی کوچک در یک کلمه، تطبیق می‌دهد", () => {
    expect(fuzzyTextMatch("کتا قرمس", "کتاب قرمز")).toBe(true);
  });
});
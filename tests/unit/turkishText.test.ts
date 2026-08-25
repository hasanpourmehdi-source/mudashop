import { describe, expect, it } from "vitest";
import { foldTurkish, toPersianDigits } from "@/lib/turkishText";

describe("foldTurkish", () => {
  it("İ پیکاپ و I عادی هر دو به i ساده برمی‌گردند", () => {
    expect(foldTurkish("İstanbul")).toBe("istanbul");
    expect(foldTurkish("Istanbul")).toBe("istanbul");
  });

  it("حروف خاص ترکی به معادل ASCII ساده می‌شوند", () => {
    expect(foldTurkish("Çanta")).toBe("canta");
    expect(foldTurkish("Şort")).toBe("sort");
    expect(foldTurkish("Büyük")).toBe("buyuk");
    expect(foldTurkish("Sırt")).toBe("sirt");
    expect(foldTurkish("Gazlı")).toBe("gazli");
    expect(foldTurkish("Ceket Örme")).toBe("ceket orme");
  });

  it("متن بی‌حرف خاص بدون تغییر می‌ماند", () => {
    expect(foldTurkish("t-shirt")).toBe("t-shirt");
  });
});

describe("toPersianDigits", () => {
  it("ارقام لاتین را به فارسی تبدیل می‌کند (نماد ٪ تبدیل نمی‌شود)", () => {
    expect(toPersianDigits("36")).toBe("۳۶");
    expect(toPersianDigits("S 42 / %100")).toBe("S ۴۲ / %۱۰۰");
  });

  it("متن فارسی دست‌نخورده می‌ماند", () => {
    expect(toPersianDigits("اندازه")).toBe("اندازه");
  });
});
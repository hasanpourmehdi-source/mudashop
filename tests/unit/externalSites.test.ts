// پوشش منطقِ خالصِ ساخت URL سایت خارجی (ترندیول/میلا) -- خارج از DB
import { describe, expect, it } from "vitest";
import {
  decodeTrendyolCategoryParam,
  encodeRawPipe,
  encodeTrendyolCategoryParam,
  normalizeUrlValue,
  pickRepresentativeCategoryRow,
} from "@/lib/externalSites";

describe("encodeTrendyolCategoryParam / decodeTrendyolCategoryParam", () => {
  it("کاماهای درونِ پارامتر دسته با _ جابه‌جا می‌شوند و برگشت‌پذیرند", () => {
    const raw = "104443,1123,104444";
    expect(encodeTrendyolCategoryParam(raw)).toBe("104443_1123_104444");
    expect(decodeTrendyolCategoryParam(encodeTrendyolCategoryParam(raw))).toBe(raw);
  });

  it("بدون کاما دست‌نخورده می‌ماند", () => {
    expect(encodeTrendyolCategoryParam("82")).toBe("82");
  });
});

describe("normalizeUrlValue -- آماده‌سازی مقدار برای query ترندیول", () => {
  it("فضای اطراف را می‌گیرد و کوچک می‌کند", () => {
    expect(normalizeUrlValue("  Büyük Boy  ")).toBe("buyuk-boy");
    expect(normalizeUrlValue("L BEDEN")).toBe("l-beden");
  });

  it("حروف خاص ترکی به معادل ساده تبدیل می‌شوند", () => {
    expect(normalizeUrlValue("Tişört")).toBe("tisort");
    expect(normalizeUrlValue("Gözlük")).toBe("gozluk");
    expect(normalizeUrlValue("Şapka")).toBe("sapka");
    expect(normalizeUrlValue("Sırt Çantası")).toBe("sirt-cantasi");
    expect(normalizeUrlValue("Çanta")).toBe("canta");
  });

  it("کاما و + و فاصله هرکدام جدا به - تبدیل می‌شوند (بدون یکی‌شدن خط‌تیره‌ها)", () => {
    expect(normalizeUrlValue("39,5")).toBe("39-5");
    // «50 x 60 + 60 x 100» => هر ۵ کاراکتر جدا، پس ۳ خط‌تیره‌ی پشت‌سرهم
    expect(normalizeUrlValue("50 x 60 + 60 x 100")).toBe("50-x-60---60-x-100");
    // «تی‌شرت» (نیم‌فاصله U+200C) عضو مجموعه `[\s,+ ]` نیست و دست‌نخورده می‌ماند
    expect(normalizeUrlValue("تی‌شرت")).toBe("تی‌شرت");
  });
});

describe("encodeRawPipe -- لوله‌ی خام query باید %7C شود", () => {
  it("| به %7C تبدیل می‌شود؛ = و & دست‌نخورده می‌مانند", () => {
    expect(encodeRawPipe("vr=size|group-l")).toBe("vr=size%7Cgroup-l");
    expect(encodeRawPipe("a=b&c=1|2")).toBe("a=b&c=1%7C2");
    expect(encodeRawPipe("wc=82")).toBe("wc=82");
  });
});

describe("pickRepresentativeCategoryRow -- عمومی‌ترین مسیر برای یک wc تکراری", () => {
  type Row = { path: string };
  const legible: Row = { path: "Erkek > Tişört" };
  const baby: Row = { path: "Anne & Çocuk > Bebek > Tişört" };
  const sport: Row = { path: "Kadın > Spor & Outdoor > Tişört" };
  const plus: Row = { path: "Kadın > Büyük Beden > Tişört" };

  it("اولین مسیر غیرتخصصی برنده می‌شود", () => {
    const rows = [baby, legible, sport];
    expect(pickRepresentativeCategoryRow(rows)?.path).toBe(legible.path);
  });

  it("اگه همه تخصصی‌اند، اولین ردیف برمی‌گردد", () => {
    expect(pickRepresentativeCategoryRow([baby, plus])?.path).toBe(baby.path);
  });

  it("آرایه خالی null برمی‌گرداند", () => {
    expect(pickRepresentativeCategoryRow([])).toBeNull();
  });
});
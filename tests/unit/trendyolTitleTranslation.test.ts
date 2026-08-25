// تستِ هسته‌ی خالصِ الگوریتم ترجمه‌ی عنوان ترندیول -- بدون DB
// (دیکشنری آزمون با همان ترتیبِ خروجیِ loadDictionary مرتب است: طولانی‌ترین اول، سپس priority نزولی)
import { describe, expect, it } from "vitest";
import { tokenizeAndTranslate, type DictionaryEntry } from "@/lib/trendyolTitleTranslation";

const dict: DictionaryEntry[] = [
  { termTr: "beli lastikli", termFa: "کمر کش‌دار", priority: 10 },
  { termTr: "slim fit", termFa: "اسلیم", priority: 10 },
  { termTr: "beyaz tişört", termFa: "تی‌شرت سفید", priority: 5 },
  { termTr: "pantolon", termFa: "شلوار", priority: 1 },
  { termTr: "pamuklu", termFa: "پنبه‌ای", priority: 1 },
  { termTr: "tişört", termFa: "تی‌شرت", priority: 1 },
  { termTr: "canta", termFa: "کیف", priority: 1 },
  { termTr: "oversize", termFa: "اورسایز", priority: 1 },
  { termTr: "regular", termFa: "رگلار", priority: 1 },
];

describe("tokenizeAndTranslate", () => {
  it("عبارت چندکلمه‌ای طولانی اول تطبیق می‌خورد و به‌عنوان یک بلوک معکوس می‌شود", () => {
    const r = tokenizeAndTranslate("Beli Lastikli Pantolon", dict);
    expect(r.translated).toBe("شلوار کمر کش‌دار");
    expect(r.unknownTerms).toEqual([]);
  });

  it("عبارت دوکلمه‌ای به‌جای تک‌تک کلماتش واحد می‌شود", () => {
    // اگه «slim fit» به‌عنوان واحد نمی‌نشست، slim/fit هر دو ناشناخته حذف می‌شدند
    const r = tokenizeAndTranslate("Slim Fit Pantolon", dict);
    expect(r.translated).toBe("شلوار اسلیم");
  });

  it("کلمه‌ی ناشناخته (برند) حذف و به unknownTerms اضافه می‌شود", () => {
    const r = tokenizeAndTranslate("Pamuklu Fjordco Pantolon", dict);
    expect(r.translated).toBe("شلوار پنبه‌ای");
    expect(r.unknownTerms).toContain("fjordco");
  });

  it("عدد (و ٪ لاتین) حفظ و ارقامش به فارسی تبدیل می‌شود", () => {
    const r = tokenizeAndTranslate("S %100 Pamuklu Pantolon", dict);
    expect(r.translated).toBe("شلوار پنبه‌ای %۱۰۰");
    expect(r.unknownTerms).toEqual([]);
  });

  it("توکن مرکب با / به تکه‌تکه ترجمه شده و با همان جداکننده به‌هم می‌چسبد", () => {
    const r = tokenizeAndTranslate("Oversize/Regular Pantolon", dict);
    expect(r.translated).toBe("شلوار اورسایز/رگلار");
  });

  it("حروف خاص ترکی جمع و حرف بزرگ بی‌اثر است (Çanta == canta)", () => {
    const r = tokenizeAndTranslate("ÇANTA", dict);
    expect(r.translated).toBe("کیف");
  });

  it("اگه هیچ کلمه‌ای ترجمه نشود، عنوان خام برمی‌گردد", () => {
    const r = tokenizeAndTranslate("Fjordco Nordic", dict);
    expect(r.translated).toBe("Fjordco Nordic");
    expect(r.unknownTerms).toEqual(["fjordco", "nordic"]);
  });

  it("ورودی خالی خالی برمی‌گرداند", () => {
    expect(tokenizeAndTranslate("", dict)).toEqual({ translated: "", unknownTerms: [] });
    expect(tokenizeAndTranslate("   ", dict)).toEqual({ translated: "   ", unknownTerms: [] });
  });

  it("کلمه‌های تک‌حرفی (مثل سایز S) نه ترجمه می‌شوند نه ناشناخته تلقی می‌شوند", () => {
    const r = tokenizeAndTranslate("S Pantolon", dict);
    expect(r.translated).toBe("شلوار");
    expect(r.unknownTerms).toEqual([]);
  });

  it("نام برند از عنوانِ نمایشی کاملاً حذف می‌شود و ناشناخته حساب نمی‌شود", () => {
    const r = tokenizeAndTranslate("Pamuklu Fjordco Pantolon", dict, "Fjordco");
    expect(r.translated).toBe("شلوار پنبه‌ای");
    expect(r.unknownTerms).toEqual([]);
  });

  it("نام برند چندکلمه‌ای هم یکجا حذف می‌شود", () => {
    const r = tokenizeAndTranslate("Nordic Fjord Co Pamuklu Pantolon", dict, "Nordic Fjord Co");
    expect(r.translated).toBe("شلوار پنبه‌ای");
    expect(r.unknownTerms).toEqual([]);
  });

  it("برند حتی اگه املاش با یه اصطلاح دیکشنری قاطی شود، اولویت دارد (حذف نه ترجمه)", () => {
    // "Canta" توی دیکشنری یعنی "کیف"؛ ولی وقتی برندِ همین محصول باشه نباید ترجمه شود، باید حذف شود
    const r = tokenizeAndTranslate("Canta Pantolon", dict, "Canta");
    expect(r.translated).toBe("شلوار");
  });

  it("بدون brand، رفتار قبلی (حذف کلمه‌ی ناشناخته) دست‌نخورده می‌ماند", () => {
    const r = tokenizeAndTranslate("Pamuklu Fjordco Pantolon", dict);
    expect(r.translated).toBe("شلوار پنبه‌ای");
    expect(r.unknownTerms).toContain("fjordco");
  });
});
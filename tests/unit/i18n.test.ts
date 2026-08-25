// پشتیبانی زبان: ترجمه، تشخیص و تفکیک کلیدها
import { describe, expect, it } from "vitest";
import { t, isLang, resolveLang, DICT, LANGS, DEFAULT_LANG } from "@/lib/i18n";

describe("t", () => {
  it("متن فارسی برمی‌گرداند", () => {
    expect(t("fa", "cart")).toBe("سبد خرید");
    expect(t("fa", "installApp")).toBe("نصب اپ");
  });

  it("متن انگلیسی برمی‌گرداند", () => {
    expect(t("en", "cart")).toBe("Cart");
    expect(t("en", "myOrders")).toBe("My Orders");
  });

  it("متن ترکی برمی‌گرداند", () => {
    expect(t("tr", "cart")).toBe("Sepetim");
    expect(t("tr", "myOrders")).toBe("Siparişlerim");
  });

  it("هر کلید دیکشنری برای هر سه زبان مقدار دارد", () => {
    for (const key of Object.keys(DICT) as Array<keyof typeof DICT>) {
      for (const lang of LANGS) {
        expect(typeof t(lang, key)).toBe("string");
        expect(t(lang, key).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("isLang", () => {
  it("فقط fa/en/tr را می‌پذیرد", () => {
    expect(isLang("fa")).toBe(true);
    expect(isLang("en")).toBe(true);
    expect(isLang("tr")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isLang("")).toBe(false);
  });
});

describe("resolveLang", () => {
  it("زبان نامعتبر به پیش‌فرض سقوط می‌کند", () => {
    expect(resolveLang("en")).toBe("en");
    expect(resolveLang("fa")).toBe("fa");
    expect(resolveLang("tr")).toBe("tr");
    expect(resolveLang("xx")).toBe(DEFAULT_LANG);
    expect(resolveLang(undefined)).toBe(DEFAULT_LANG);
  });
});
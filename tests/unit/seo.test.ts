// ابزارهای سئو -- آدرس مطلق، توضیح متا، قیمت فارسی
import { describe, expect, it } from "vitest";
import { toMetaDescription, priceFa, siteUrl } from "@/lib/seo";

describe("siteUrl", () => {
  it("مسیر نسبی را به آدرس مطلق تبدیل می‌کند", () => {
    expect(siteUrl("/products/mazon/x")).toMatch(/^https?:\/\/.+\/products\/mazon\/x$/);
    expect(siteUrl("/products")).toBe(`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/products`);
  });

  it("بدون مسیر، دامنه را می‌سازد", () => {
    expect(siteUrl("")).toBe(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  });
});

describe("toMetaDescription", () => {
  it("متن کوتاه را کامل نگه می‌دارد و فاصله‌های اضافی را حذف می‌کند", () => {
    expect(toMetaDescription("  سلام    دنیا ")).toBe("سلام دنیا");
  });

  it("متن بلند را به ۱۵۵ کاراکتر محدود می‌کند", () => {
    const long = "ق".repeat(300);
    const out = toMetaDescription(long);
    expect(out.length).toBeLessThanOrEqual(156);
    expect(out.endsWith("…")).toBe(true);
  });

  it("خالی/null به خالی برمی‌گردد", () => {
    expect(toMetaDescription(undefined)).toBe("");
    expect(toMetaDescription("")).toBe("");
  });
});

describe("priceFa", () => {
  it("قیمت را با جداکننده و واحد فارسی می‌سازد", () => {
    expect(priceFa(120000)).toBe("۱۲۰٬۰۰۰ تومان");
    expect(priceFa(0)).toBe("۰ تومان");
  });

  it("undefined به خالی برمی‌گردد", () => {
    expect(priceFa(undefined)).toBe("");
  });
});
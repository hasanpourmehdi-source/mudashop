// پوشش Gherkin: 17-online-tracking.feature (لینک رهگیری آنلاین)
import { describe, expect, it } from "vitest";
import { trackingUrl } from "@/lib/trackingLink";

describe("trackingUrl -- ساخت لینک رهگیری بر اساس روش ارسال", () => {
  it("پست پیشتاز با کد ۱۰ رقمی -> لینک tracking.post.ir", () => {
    expect(trackingUrl("1234567890", "پست پیشتاز")).toBe(
      "https://tracking.post.ir/SearchIndex.aspx?igc=1234567890"
    );
  });

  it("پست سفارشی هم به پست اشاره می‌کند", () => {
    expect(trackingUrl("9876543210", "پست سفارشی")).toContain("tracking.post.ir");
  });

  it("تیپاکس -> لینک tipaxonline", () => {
    expect(trackingUrl("T123456789", "تیپاکس")).toBe(
      "https://www.tipaxonline.com/tracking/?trackingcode=T123456789"
    );
  });

  it("پیک موتوری (شماره تماس) -> بدون لینک", () => {
    expect(trackingUrl("09120000000", "پیک موتوری")).toBeNull();
  });

  it("بدون روش ارسال، کد ۱۰ رقمی -> پست (fallback)", () => {
    expect(trackingUrl("1234567890")).toContain("tracking.post.ir");
  });

  it("بدون روش ارسال، کد غیر ۱۰ رقمی -> تییپاکس (fallback)", () => {
    expect(trackingUrl("TIPAX123456")).toContain("tipaxonline.com");
  });

  it("کد خالی -> بدون لینک", () => {
    expect(trackingUrl("   ")).toBeNull();
  });
});
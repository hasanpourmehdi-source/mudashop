import { describe, expect, it } from "vitest";
import {
  GIFT_WRAP_COST,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
  calculateShipping,
  availableShippingMethods,
  isTehranCity,
} from "@/lib/shipping";

describe("calculateShipping", () => {
  it("زیر آستانه، هزینه ثابت ارسال دارد", () => {
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD - 1)).toBe(SHIPPING_COST);
  });

  it("الزاماً از آستانه، رایگان می‌شود", () => {
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(calculateShipping(FREE_SHIPPING_THRESHOLD + 100)).toBe(0);
  });

  it("سبد خالی هم هزینه ارسال دارد", () => {
    expect(calculateShipping(0)).toBe(SHIPPING_COST);
  });
});

describe("isTehranCity", () => {
  it("تهران با فاصله‌های اضافه هم قبول است", () => {
    expect(isTehranCity("  تهران ")).toBe(true);
  });

  it("فقط دقیقاً «تهران» است", () => {
    expect(isTehranCity("تهرانپارس")).toBe(false);
    expect(isTehranCity("شیراز")).toBe(false);
  });
});

describe("availableShippingMethods", () => {
  it("در تهران همه روش‌ها در دسترس‌اند", () => {
    const methods = availableShippingMethods("تهران");
    expect(methods).toContain("پیک موتوری");
    expect(methods).toContain("پست پیشتاز");
    expect(methods).toContain("تیپاکس");
    expect(methods).toContain("پست سفارشی");
  });

  it("خارج از تهران، پیک موتوری حذف می‌شود", () => {
    const methods = availableShippingMethods("شیراز");
    expect(methods).not.toContain("پیک موتوری");
    expect(methods).toContain("تیپاکس");
  });
});

it("GIFT_WRAP_COST یک مقدار ثابت مثبت دارد", () => {
  expect(GIFT_WRAP_COST).toBeGreaterThan(0);
});
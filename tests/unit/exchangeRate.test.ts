import { describe, expect, it } from "vitest";
import { applyExchangeRate } from "@/lib/exchangeRate";

describe("applyExchangeRate -- تبدیل ارزی با رند به ۱۰۰۰ تومان", () => {
  it("ضرب در نرخ × درصد سود و رندِ نزدیک (بالاگردی) به ۱۰۰۰ تومان", () => {
    // 100 × 50 × (1+0.10) = 5500 -> رندکاری 5500→6000
    expect(applyExchangeRate(100, { rate: 50, profitPercent: 10 })).toBe(6_000);
  });

  it("رندِ پایین‌گرد وقتی به نصف آستانه نمی‌رسد", () => {
    // 100 × 40 × 1.05 = 4200 -> 4200→4000 (4.2 رند=4)
    expect(applyExchangeRate(100, { rate: 40, profitPercent: 5 })).toBe(4_000);
  });

  it("بدون سود و با نرخ ساده رند درست می‌شود", () => {
    // 30 × 30 = 900 -> 900→1000 (0.9 رند=1)
    expect(applyExchangeRate(30, { rate: 30, profitPercent: 0 })).toBe(1_000);
  });

  it("نرخ صفر (ثبت‌نشده) صفر برمی‌گرداند، نه عدد فرضی", () => {
    expect(applyExchangeRate(100, { rate: 0, profitPercent: 0 })).toBe(0);
  });

  it("مقدار صفر صفر است و رند برای اعداد سه‌رقمیِ دقیق بی‌اثر است", () => {
    expect(applyExchangeRate(0, { rate: 50, profitPercent: 10 })).toBe(0);
    expect(applyExchangeRate(200, { rate: 10, profitPercent: 0 })).toBe(2_000);
  });
});
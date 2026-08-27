import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  it("تا سقفِ مجاز، همه‌ی درخواست‌ها اجازه می‌گیرن", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("بعد از رسیدن به سقف، درخواستِ بعدی رد می‌شه", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    }
    const result = checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("کلیدهای متفاوت (مثلاً IPِ متفاوت) کاملاً مستقل شمارش می‌شن", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(keyA, { limit: 3, windowMs: 60_000 });
    expect(checkRateLimit(keyA, { limit: 3, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkRateLimit(keyB, { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("بعد از گذشتنِ windowMs (شبیه‌سازی‌شده با پنجره‌ی خیلی کوتاه)، دوباره اجازه می‌ده", async () => {
    const key = `test-${Math.random()}`;
    checkRateLimit(key, { limit: 1, windowMs: 10 });
    expect(checkRateLimit(key, { limit: 1, windowMs: 10 }).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(checkRateLimit(key, { limit: 1, windowMs: 10 }).allowed).toBe(true);
  });
});

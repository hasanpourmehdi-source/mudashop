import { describe, expect, it, beforeEach } from "vitest";
import { getAppliedCouponCode, setAppliedCouponCode } from "@/lib/appliedCoupon";

const KEY = "mudashop-applied-coupon";
const store = new Map<string, string>();

const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// در محیط node `window` وجود ندارد؛ برای تست round-trip، localStorage را شبیه‌سازی می‌کنیم
// ماژول مستقیماً به localStorage سراسری دست می‌زند (نه window.localStorage)
function mountFakeWindow() {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", {
    value: fakeStorage,
    configurable: true,
    writable: true,
  });
}

function unmountWindow() {
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "localStorage");
}

describe("appliedCoupon", () => {
  beforeEach(() => {
    store.clear();
    mountFakeWindow();
  });

  it("get/set رفت و برگشت دارد", () => {
    setAppliedCouponCode("WELCOME10");
    expect(getAppliedCouponCode()).toBe("WELCOME10");
  });

  it("ست کردن با رشته خالی، کلید را پاک می‌کند", () => {
    setAppliedCouponCode("WELCOME10");
    setAppliedCouponCode("");
    expect(getAppliedCouponCode()).toBe("");
    expect(store.has(KEY)).toBe(false);
  });

  it("بدون مقدار ذخیره‌شده رشته خالی برمی‌گرداند", () => {
    expect(getAppliedCouponCode()).toBe("");
  });

  it("بدون window (محیط سرور) no-op است", () => {
    unmountWindow();
    expect(() => setAppliedCouponCode("WELCOME10")).not.toThrow();
    expect(getAppliedCouponCode()).toBe("");
  });
});
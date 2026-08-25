// پوشش Gherkin: 13-tracking-code-edit.feature (چندکدی بودن trackingCode)
import { describe, expect, it } from "vitest";
import { parseTrackingCodes, serializeTrackingCodes } from "@/lib/trackingCodes";

describe("parseTrackingCodes", () => {
  it("تهی/null/undefined => آرایه خالی", () => {
    expect(parseTrackingCodes(null)).toEqual([]);
    expect(parseTrackingCodes(undefined)).toEqual([]);
    expect(parseTrackingCodes("")).toEqual([]);
  });

  it("آرایه‌ی JSON را به چند کد می‌شکند", () => {
    expect(parseTrackingCodes('["A123", "B456"]')).toEqual(["A123", "B456"]);
  });

  it("ورودی‌های یکسره خالی/غیررشته‌ای فیلتر می‌شوند؛ کدِ با فاصله دست‌نخورده می‌ماند", () => {
    expect(parseTrackingCodes('["A1", "", 42, "  "]')).toEqual(["A1"]);
    // فقط فیلترِ یکسره خالی انجام می‌شود (trim نه) -- اگر لازم شد serialize فضای دور کد را می‌گیرد
    expect(parseTrackingCodes('["  A123  "]')).toEqual(["  A123  "]);
  });

  it("داده‌ی قدیمی (رشته خام) به‌عنوان تنها کد شناخته می‌شود", () => {
    expect(parseTrackingCodes("A123")).toEqual(["A123"]);
    expect(parseTrackingCodes('{"tracking":"A123"}')).toEqual(['{"tracking":"A123"}']);
  });

  it("رشته‌ی منفردِ دور-فضا trim می‌شود (مسیر fallback)", () => {
    expect(parseTrackingCodes("  A123  ")).toEqual(["A123"]);
  });
});

describe("serializeTrackingCodes", () => {
  it("آرایه را trim و فیلتر و JSON می‌کند", () => {
    expect(serializeTrackingCodes([" A1 ", "", "B2"])).toBe('["A1","B2"]');
  });

  it("گِرد است: serialize -> parse همان کدها را برمی‌گرداند", () => {
    const codes = ["A123", "B456"];
    expect(parseTrackingCodes(serializeTrackingCodes(codes))).toEqual(codes);
  });
});
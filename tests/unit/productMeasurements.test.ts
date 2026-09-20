import { describe, expect, it } from "vitest";
import { parseVariantMeasurements } from "@/lib/productMeasurements";

describe("parseVariantMeasurements -- خواندنِ اندازه‌ی واقعیِ یه ترکیب از JSON ذخیره‌شده", () => {
  it("null/undefined/رشته‌ی خالی => آرایه‌ی خالی", () => {
    expect(parseVariantMeasurements(null)).toEqual([]);
    expect(parseVariantMeasurements(undefined)).toEqual([]);
    expect(parseVariantMeasurements("")).toEqual([]);
  });

  it("JSON معتبر رو درست پارس می‌کند", () => {
    const raw = JSON.stringify([
      { label: "دور کمر", cm: 78 },
      { label: "قد", cm: 101 },
    ]);
    expect(parseVariantMeasurements(raw)).toEqual([
      { label: "دور کمر", cm: 78 },
      { label: "قد", cm: 101 },
    ]);
  });

  it("JSON خراب (نه یه آرایه‌ی معتبر) => آرایه‌ی خالی، بدون کرش", () => {
    expect(parseVariantMeasurements("{not json")).toEqual([]);
    expect(parseVariantMeasurements("{}")).toEqual([]);
    expect(parseVariantMeasurements("null")).toEqual([]);
  });

  it("ردیف‌های ناقص/نامعتبر (بدون label، cm منفی/صفر/غیرعددی) حذف می‌شن", () => {
    const raw = JSON.stringify([
      { label: "دور کمر", cm: 78 },
      { label: "", cm: 50 },
      { label: "بی‌عدد", cm: "۵۰" },
      { label: "منفی", cm: -5 },
      { label: "صفر", cm: 0 },
      { cm: 60 },
    ]);
    expect(parseVariantMeasurements(raw)).toEqual([{ label: "دور کمر", cm: 78 }]);
  });
});

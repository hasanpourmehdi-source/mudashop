// پوشش Gherkin: 20-package-arrival.feature (تحویل جزئی/چند بسته)
import { describe, expect, it } from "vitest";
import {
  parsePackageStatuses,
  serializePackageStatuses,
  mergePackageStatuses,
  markPackageArrived,
} from "@/lib/packageStatuses";

describe("parsePackageStatuses / serializePackageStatuses", () => {
  it("رشته خالی یا null -> آرایه خالی", () => {
    expect(parsePackageStatuses(null)).toEqual([]);
    expect(parsePackageStatuses("")).toEqual([]);
    expect(parsePackageStatuses("not json")).toEqual([]);
  });

  it("round-trip بین serialize و parse", () => {
    const statuses: { code: string; status: "IN_TRANSIT" | "ARRIVED"; arrivedAt: string | null }[] = [
      { code: "A1", status: "IN_TRANSIT", arrivedAt: null },
      { code: "B2", status: "ARRIVED", arrivedAt: "2026-08-25T10:00:00.000Z" },
    ];
    expect(parsePackageStatuses(serializePackageStatuses(statuses))).toEqual(statuses);
  });
});

describe("mergePackageStatuses -- هنگام ثبت/ویرایش کدها", () => {
  it("کدهای جدید IN_TRANSIT اضافه و وضعیت کدهای موجود حفظ می‌شوند", () => {
    const existing = serializePackageStatuses([
      { code: "A1", status: "ARRIVED", arrivedAt: "2026-08-25T10:00:00.000Z" },
    ]);
    const merged = mergePackageStatuses(existing, ["A1", "C3"]);
    expect(merged).toEqual([
      { code: "A1", status: "ARRIVED", arrivedAt: "2026-08-25T10:00:00.000Z" },
      { code: "C3", status: "IN_TRANSIT", arrivedAt: null },
    ]);
  });

  it("بدون داده‌ی قبلی، همه IN_TRANSIT هستند", () => {
    const merged = mergePackageStatuses(null, ["A1", "B2"]);
    expect(merged.every((s) => s.status === "IN_TRANSIT")).toBe(true);
  });
});

describe("markPackageArrived -- تحویل جزئی", () => {
  const now = new Date("2026-08-26T10:00:00.000Z");

  it("یک بسته تحویل داده شد اما بقیه در راه -> همه رسیده نیست", () => {
    const raw = serializePackageStatuses([
      { code: "A1", status: "IN_TRANSIT", arrivedAt: null },
      { code: "B2", status: "IN_TRANSIT", arrivedAt: null },
    ]);
    const { statuses, found, allArrived } = markPackageArrived(raw, "A1", now);
    expect(found).toBe(true);
    expect(allArrived).toBe(false);
    expect(statuses.find((s) => s.code === "A1")).toEqual({
      code: "A1",
      status: "ARRIVED",
      arrivedAt: now.toISOString(),
    });
  });

  it("آخرین بسته تحویل شد -> همه رسیده", () => {
    const raw = serializePackageStatuses([
      { code: "A1", status: "ARRIVED", arrivedAt: "2026-08-25T10:00:00.000Z" },
      { code: "B2", status: "IN_TRANSIT", arrivedAt: null },
    ]);
    const { allArrived } = markPackageArrived(raw, "B2", now);
    expect(allArrived).toBe(true);
  });

  it("کد ناموجود -> found=false", () => {
    const raw = serializePackageStatuses([{ code: "A1", status: "IN_TRANSIT", arrivedAt: null }]);
    const { found } = markPackageArrived(raw, "NOPE", now);
    expect(found).toBe(false);
  });
});
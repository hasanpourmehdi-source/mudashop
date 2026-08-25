// تایملاین رهگیری مرحله‌به‌مرحله -- ساخت ردیف زمانی از تاریخچه + بسته‌ها
import { describe, expect, it } from "vitest";
import { buildTrackingTimeline, type TrackingTimelineInput } from "@/lib/trackingTimeline";
import { serializePackageStatuses } from "@/lib/packageStatuses";

const baseInput: TrackingTimelineInput = {
  status: "PROCESSING",
  statusHistory: [
    { id: "h1", status: "PENDING", note: "سفارش توسط مشتری ثبت شد", createdAt: "2026-08-10T10:00:00.000Z" },
    { id: "h2", status: "PROCESSING", note: "پرداخت تأیید شد", createdAt: "2026-08-10T12:00:00.000Z" },
  ],
  packageStatuses: null,
};

describe("buildTrackingTimeline", () => {
  it("سفارش در جریان: آخرین رویداد active و بقیه done", () => {
    const entries = buildTrackingTimeline(baseInput);
    expect(entries.map((e) => e.state)).toEqual(["done", "active"]);
    expect(entries[0].id).toBe("h-h1");
    expect(entries[0].title).toBe("سفارش توسط مشتری ثبت شد");
    expect(entries[1].id).toBe("h-h2");
  });

  it("سفارش تحویل‌شده: همه done و هیچ گره‌ی فعالی نیست", () => {
    const entries = buildTrackingTimeline({
      ...baseInput,
      status: "DELIVERED",
      statusHistory: [
        ...baseInput.statusHistory,
        { id: "h3", status: "SHIPPED", note: "سفارش ارسال شد", createdAt: "2026-08-12T08:00:00.000Z" },
        { id: "h4", status: "DELIVERED", note: "سفارش تحویل داده شد", createdAt: "2026-08-14T09:00:00.000Z" },
      ],
    });
    expect(entries.every((e) => e.state === "done")).toBe(true);
  });

  it("سفارش لغوشده: همه done", () => {
    const entries = buildTrackingTimeline({
      ...baseInput,
      status: "CANCELLED",
      statusHistory: [
        ...baseInput.statusHistory,
        { id: "h3", status: "CANCELLED", note: "سفارش توسط مشتری لغو شد", createdAt: "2026-08-11T09:00:00.000Z" },
      ],
    });
    expect(entries.every((e) => e.state === "done")).toBe(true);
  });

  it("رویداد تحویلِ تکی بسته‌ها به‌همراه تاریخچه در یک ردیف زمانی واحد ادغام می‌شود", () => {
    const packageStatuses = serializePackageStatuses([
      { code: "A1", status: "ARRIVED", arrivedAt: "2026-08-13T10:00:00.000Z" },
      { code: "B2", status: "IN_TRANSIT", arrivedAt: null },
    ]);
    const entries = buildTrackingTimeline({
      ...baseInput,
      status: "SHIPPED",
      packageStatuses,
      statusHistory: [
        ...baseInput.statusHistory,
        { id: "h3", status: "SHIPPED", note: "سفارش ارسال شد", createdAt: "2026-08-12T08:00:00.000Z" },
      ],
    });
    const packageEntry = entries.find((e) => e.id === "pkg-A1");
    expect(packageEntry).toMatchObject({ kind: "package", state: "active" });
    expect(packageEntry?.title).toContain("بسته A1");
    // بسته‌ی در راه گره‌ای ندارد
    expect(entries.some((e) => e.id === "pkg-B2")).toBe(false);
  });

  it("مرتب‌سازی زمانی بین تاریخچه و بسته‌ها درست است", () => {
    const entries = buildTrackingTimeline({
      ...baseInput,
      status: "SHIPPED",
      packageStatuses: serializePackageStatuses([
        { code: "A1", status: "ARRIVED", arrivedAt: "2026-08-11T08:00:00.000Z" }, // قبل از «پرداخت تأیید شد»
      ]),
      statusHistory: [
        { id: "h1", status: "PENDING", note: "ثبت", createdAt: "2026-08-10T10:00:00.000Z" },
        { id: "h2", status: "PROCESSING", note: "پرداخت", createdAt: "2026-08-12T12:00:00.000Z" },
      ],
    });
    expect(entries[0].id).toBe("h-h1");
    expect(entries[1].id).toBe("pkg-A1");
    expect(entries[2].id).toBe("h-h2");
  });

  it("تاریخچه‌ی خالی -> تایملاین خالی", () => {
    const entries = buildTrackingTimeline({
      status: "PROCESSING",
      statusHistory: [],
      packageStatuses: null,
    });
    expect(entries).toHaveLength(0);
  });
});
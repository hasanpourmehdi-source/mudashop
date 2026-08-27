import { describe, expect, it } from "vitest";
import { nextReminderStage, buildStage1Message, buildStage2Message } from "@/lib/abandonedCart";

const THRESHOLDS = { stage1H: 24, stage2H: 72, stage3H: 168 };
const HOUR = 60 * 60 * 1000;

describe("nextReminderStage", () => {
  const now = new Date("2026-01-10T00:00:00.000Z");

  it("سبدِ تازه (زیر آستانه‌ی مرحله ۱) هیچ مرحله‌ای نمی‌گیره", () => {
    const updatedAt = new Date(now.getTime() - 10 * HOUR);
    expect(nextReminderStage({ updatedAt, reminderStage: 0 }, now, THRESHOLDS)).toBeNull();
  });

  it("بعد از ۲۴ ساعت و reminderStage=0 => مرحله ۱", () => {
    const updatedAt = new Date(now.getTime() - 25 * HOUR);
    expect(nextReminderStage({ updatedAt, reminderStage: 0 }, now, THRESHOLDS)).toBe(1);
  });

  it("بعد از ۷۲ ساعت و reminderStage=1 => مرحله ۲", () => {
    const updatedAt = new Date(now.getTime() - 73 * HOUR);
    expect(nextReminderStage({ updatedAt, reminderStage: 1 }, now, THRESHOLDS)).toBe(2);
  });

  it("بعد از ۱۶۸ ساعت و reminderStage=2 => مرحله ۳ (اطلاع به ادمین)", () => {
    const updatedAt = new Date(now.getTime() - 169 * HOUR);
    expect(nextReminderStage({ updatedAt, reminderStage: 2 }, now, THRESHOLDS)).toBe(3);
  });

  it("مرحله‌ها هیچ‌وقت جهش نمی‌کنن -- حتی اگه خیلی وقت گذشته باشه، هربار فقط یه مرحله جلو می‌ره", () => {
    // ۲۰۰ ساعت گذشته (بیشتر از هر سه آستانه) ولی reminderStage هنوز 0 -- باید فقط مرحله ۱ برگرده، نه ۳
    const updatedAt = new Date(now.getTime() - 200 * HOUR);
    expect(nextReminderStage({ updatedAt, reminderStage: 0 }, now, THRESHOLDS)).toBe(1);
  });

  it("reminderStage=3 (نهایی) دیگه هیچ مرحله‌ی جدیدی برنمی‌گردونه", () => {
    const updatedAt = new Date(now.getTime() - 500 * HOUR);
    expect(nextReminderStage({ updatedAt, reminderStage: 3 }, now, THRESHOLDS)).toBeNull();
  });
});

describe("buildStage1Message", () => {
  it("یه کالا: بدون «و X کالای دیگر»", () => {
    const { body } = buildStage1Message([{ title: "تیشرت", quantity: 1 }]);
    expect(body).toContain("تیشرت");
    expect(body).not.toContain("کالای دیگر");
  });

  it("چند کالا: تعداد کل و اسمِ اولی + بقیه", () => {
    const { body } = buildStage1Message([
      { title: "تیشرت", quantity: 2 },
      { title: "شلوار", quantity: 1 },
    ]);
    expect(body).toContain("۳"); // جمع تعداد
    expect(body).toContain("تیشرت");
    expect(body).toContain("۱ کالای دیگر");
  });
});

describe("buildStage2Message", () => {
  it("بدون سیگنالِ موجودیِ واقعی -- پیامِ عمومی (بدون ادعای ساختگی)", () => {
    const { title, body } = buildStage2Message([{ title: "تیشرت", quantity: 1 }], []);
    expect(title).not.toContain("موجودی");
    expect(body).not.toContain("تموم");
  });

  it("با سیگنالِ موجودیِ واقعی -- اسمِ کالای کم‌موجود رو صریح می‌گه", () => {
    const { title, body } = buildStage2Message([{ title: "تیشرت", quantity: 1 }], ["تیشرت"]);
    expect(title).toContain("موجودی");
    expect(body).toContain("تیشرت");
    expect(body).toContain("تموم");
  });
});

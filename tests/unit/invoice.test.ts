// فاکتور و پیش‌فاکتور: تبدیل شمسی، شماره فاکتور، محاسبات مبلغ
import { describe, expect, it } from "vitest";
import {
  toJalali,
  formatJalaliDate,
  formatJalaliLong,
  invoiceNumber,
  lineTotal,
  sumLines,
  paymentStatusLabel,
  isProforma,
} from "@/lib/invoice";

describe("toJalali", () => {
  it("نوروز ۱۴۰۴ (۲۱ مارس ۲۰۲۵)", () => {
    const j = toJalali(new Date(2025, 2, 21)); // UTC pitfalls avoided via local
    expect(j).toEqual({ jy: 1404, jm: 1, jd: 1 });
  });

  it("نوروز ۱۴۰۳ (۲۰ مارس ۲۰۲۴)", () => {
    const j = toJalali(new Date(2024, 2, 20));
    expect(j.jy).toBe(1403);
    expect(j.jm).toBe(1);
    expect(j.jd).toBe(1);
  });

  it("۱ ژانویه ۲۰۲۵ = ۱۲ دی ۱۴۰۳", () => {
    const j = toJalali(new Date(2025, 0, 1));
    expect(j).toEqual({ jy: 1403, jm: 10, jd: 12 });
  });

  it("سال کبیسه را درست حساب می‌کند (۲۹ اسفند ۱۴۰۳)", () => {
    // ۱۹ مارس ۲۰۲۵
    const j = toJalali(new Date(2025, 2, 19));
    expect(j).toEqual({ jy: 1403, jm: 12, jd: 29 });
  });
});

describe("formatJalaliDate / formatJalaliLong", () => {
  it("فرمت عددی و بلند فارسی", () => {
    const date = new Date(2025, 4, 20); // ۳۰ اردیبهشت ۱۴۰۴
    expect(formatJalaliDate(date)).toBe("۱۴۰۴/۰۲/۳۰");
    expect(formatJalaliLong(date)).toBe("۳۰ اردیبهشت ۱۴۰۴");
  });
});

describe("invoiceNumber", () => {
  it("شماره فاکتور با سال شمسی و پسوند نوع", () => {
    const num = invoiceNumber({ orderId: "abc1234def5678", kind: "invoice", date: new Date(2025, 2, 21) });
    expect(num).toMatch(/^MDS-1404-I-[A-F0-9]{6}$/);
    const pro = invoiceNumber({ orderId: "abc1234def5678", kind: "proforma", date: new Date(2025, 2, 21) });
    expect(pro).toContain("-P-");
  });

  it("برای دو سفارش متفاوت، شماره‌ها متفاوت‌اند", () => {
    const a = invoiceNumber({ orderId: "order-aaaaaa", kind: "invoice", date: new Date(2025, 2, 21) });
    const b = invoiceNumber({ orderId: "order-bbbbbb", kind: "invoice", date: new Date(2025, 2, 21) });
    expect(a).not.toBe(b);
  });
});

describe("مبلغ", () => {
  it("lineTotal و sumLines", () => {
    expect(lineTotal(100000, 3)).toBe(300000);
    expect(sumLines([{ price: 100, quantity: 2 }, { price: 50, quantity: 4 }])).toBe(400);
    expect(sumLines([])).toBe(0);
  });
});

describe("وضعیت پرداخت", () => {
  it("برچسب فارسی و تشخیص پیش‌فاکتور", () => {
    expect(paymentStatusLabel("PAID")).toBe("پرداخت‌شده");
    expect(paymentStatusLabel("AWAITING_PAYMENT")).toBe("منتظر پرداخت");
    expect(paymentStatusLabel("UNKNOWN")).toBe("UNKNOWN");
    expect(isProforma("PAID")).toBe(false);
    expect(isProforma("PENDING")).toBe(true);
    expect(isProforma(null)).toBe(true);
  });
});
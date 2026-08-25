// امنیت حساب: تشخیص دستگاه، اعتبار نشست، پارس کوکی
import { describe, expect, it } from "vitest";
import {
  parseUserAgent,
  buildDeviceLabel,
  isSessionValid,
  fallbackDeviceId,
  readCookie,
  parseSetCookies,
} from "@/lib/security";

describe("parseUserAgent", () => {
  it("Chrome و Windows را تشخیص می‌دهد", () => {
    const p = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    );
    expect(p.browser).toBe("Chrome");
    expect(p.os).toBe("Windows");
    expect(p.kind).toBe("رایانه");
  });

  it("Firefox و Android (موبایل) را تشخیص می‌دهد", () => {
    const p = parseUserAgent(
      "Mozilla/5.0 (Linux; Android 13; SM-G991B) Gecko/20200101 Firefox/121.0"
    );
    expect(p.browser).toBe("Firefox");
    expect(p.os).toBe("Android");
    expect(p.kind).toBe("موبایل");
  });

  it("iPad را تبلت می‌داند", () => {
    const p = parseUserAgent("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) Version/16.0 Mobile Safari/604.1");
    expect(p.kind).toBe("تبلت");
    expect(p.browser).toBe("Safari");
    expect(p.os).toBe("iOS");
  });

  it("رشته‌ی ناشناس را مدیریت می‌کند", () => {
    const p = parseUserAgent("");
    expect(p.browser).toBe("مرورگر ناشناس");
    expect(p.os).toBe("سیستم‌عامل ناشناس");
  });
});

describe("buildDeviceLabel", () => {
  it("برچسب خوانا می‌سازد", () => {
    expect(
      buildDeviceLabel("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36")
    ).toBe("Chrome روی Windows");
  });

  it("برای خالی/ناشناس، دستگاه ناشناس برمی‌گرداند", () => {
    expect(buildDeviceLabel(undefined)).toBe("دستگاه ناشناس");
    expect(buildDeviceLabel(null)).toBe("دستگاه ناشناس");
    expect(buildDeviceLabel("curl/8.0")).toBe("دستگاه ناشناس");
  });
});

describe("isSessionValid", () => {
  it("نشست سالم معتبر است", () => {
    expect(isSessionValid({ revokedAt: null, tokenVer: "a", userVer: "a" })).toBe(true);
    expect(isSessionValid({ revokedAt: null, tokenVer: undefined, userVer: "a" })).toBe(true);
  });

  it("نشست باطل‌شده نامعتبر است", () => {
    expect(isSessionValid({ revokedAt: new Date(), tokenVer: "a", userVer: "a" })).toBe(false);
  });

  it("اختلاف نسخه‌ی امنیتی، نشست را باطل می‌کند", () => {
    expect(isSessionValid({ revokedAt: null, tokenVer: "old", userVer: "new" })).toBe(false);
  });
});

describe("fallbackDeviceId", () => {
  it("برای بدون کوکی پس‌انداز می‌سازد", () => {
    expect(fallbackDeviceId(null)).toBe("ua:none");
    expect(fallbackDeviceId("Chrome")).toBe("ua:Chrome");
  });
});

describe("readCookie", () => {
  it("مقدار کوکی را از هدر می‌خواند", () => {
    expect(readCookie("a=1; device_id=abc; b=2", "device_id")).toBe("abc");
    expect(readCookie("device_id=abc", "device_id")).toBe("abc");
    expect(readCookie(null, "device_id")).toBeNull();
    expect(readCookie("a=1", "device_id")).toBeNull();
  });
});

describe("parseSetCookies", () => {
  it("هدر set-cookie را به جفت نام/مقدار تبدیل می‌کند", () => {
    const out = parseSetCookies("authjs.session-token=xyz; Path=/; HttpOnly, foo=bar; Path=/");
    expect(out).toEqual([
      ["authjs.session-token", "xyz"],
      ["foo", "bar"],
    ]);
  });

  it("هدر خالی -> آرایه‌ی خالی", () => {
    expect(parseSetCookies(null)).toEqual([]);
  });
});
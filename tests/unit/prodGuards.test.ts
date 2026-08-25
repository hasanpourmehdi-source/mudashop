// گاردهای امنیتی production: ویژگی‌های شبیه‌سازی (شارژ کیف پول، رمز بازیابی)
// نباید در محیط تولید در دسترس باشند.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function importTopup() {
  return import("@/app/api/wallet/topup/route");
}

async function importForgotPassword() {
  return import("@/app/api/auth/forgot-password/route");
}

describe("wallet/topup -- درگاه شبیه‌سازی در production بسته است", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("در production حتی با احراز هویت، 503 می‌دهد و شارژ نمی‌کند", async () => {
    // auth را ماک می‌کنیم که کاربر وارد باشد؛ درگاه باید همچنان بسته باشد
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
    }));
    const prismaTx = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { $transaction: prismaTx } }));

    const { POST } = await importTopup();
    const req = { json: async () => ({ amount: 100000 }) };
    const res = await POST(req as Request);

    expect(res.status).toBe(503);
    expect(prismaTx).not.toHaveBeenCalled();
  });
});

describe("forgot-password -- لینک رمز فقط در dev برمی‌گردد", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("در production هیچ لینک بازیابی در پاسخ نیست", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "u1",
            email: "x@y.com",
            password: "hash",
          }),
        },
        passwordResetToken: {
          create: vi.fn().mockResolvedValue(undefined),
        },
      },
    }));

    const { POST } = await importForgotPassword();
    const req = { json: async () => ({ email: "x@y.com" }) };
    const res = await POST(req as Request);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.devResetLink).toBeNull();
  });

  it("در dev لینک بازیابی برای تست در اختیار است", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "u1",
            email: "x@y.com",
            password: "hash",
          }),
        },
        passwordResetToken: {
          create: vi.fn().mockResolvedValue(undefined),
        },
      },
    }));

    const { POST } = await importForgotPassword();
    const req = { json: async () => ({ email: "x@y.com" }) };
    const res = await POST(req as Request);
    const body = await res.json();

    expect(body.devResetLink).toContain("/auth/reset-password?token=");
  });

  it("کاربر ناموجود در production هم پیام موفقیت بدون لینک می‌گیرد (نشت نشود)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue(null) },
        passwordResetToken: { create: vi.fn() },
      },
    }));

    const { POST } = await importForgotPassword();
    const req = { json: async () => ({ email: "nobody@y.com" }) };
    const res = await POST(req as Request);
    const body = await res.json();

    expect(body).toEqual({ success: true, devResetLink: null });
  });
});
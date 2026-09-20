"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ensureDeviceCookie } from "@/lib/clientDevice";
import { CaptchaField, type CaptchaValue } from "@/components/CaptchaField";
import { Spinner } from "@/components/Spinner";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaValue>({ captchaId: "", captchaAnswer: "" });
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    ensureDeviceCookie();

    const res = await signIn("credentials", {
      email,
      password,
      captchaId: captcha.captchaId,
      captchaAnswer: captcha.captchaAnswer,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      // next-auth پیام دقیقِ throw شده توی authorize (مثلاً «قفل موقت») رو به
      // کلاینت نمی‌ده -- برای همین جدا می‌پرسیم که آیا این حساب الان قفله یا نه
      const statusRes = await fetch("/api/auth/login-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const status = await statusRes.json().catch(() => ({ locked: false }));
      // کپچا یک‌بارمصرفه -- بعد هر خطا باید تازه شود
      setCaptchaKey((k) => k + 1);
      setCaptcha({ captchaId: "", captchaAnswer: "" });
      // اگه خودِ کپچا غلط بود، پیام دقیقِ authorize رو نشون بده
      if (res.error.includes("کد امنیتی")) {
        setError(res.error);
      } else {
        setError(
          status.locked
            ? `به‌خاطر تلاش‌های ناموفق زیاد، این حساب موقتاً قفل شده -- حدود ${status.minutesLeft} دقیقه دیگر دوباره امتحان کن.`
            : "ایمیل یا رمز عبور اشتباه است"
        );
      }
      return;
    }

    // reload کامل صفحه تا session به‌درستی rehydrate بشه
    window.location.href = callbackUrl;
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-6 text-center">ورود به مُداشاپ</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">ایمیل</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">رمز عبور</label>
            <Link href="/auth/forgot-password" className="text-xs text-[var(--color-wine)]">
              رمز عبور را فراموش کرده‌اید؟
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border cut-line rounded-lg px-3 py-2 pl-10 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute inset-y-0 left-0 px-3 flex items-center text-[var(--color-muted)]"
              aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-5.5 0-9.5-4-11-7 .78-1.36 2.03-3.14 3.77-4.56M9.9 4.24A10.4 10.4 0 0 1 12 4c5.5 0 9.5 4 11 7-.6 1.06-1.5 2.36-2.7 3.6M3 3l18 18M9.53 9.53a3 3 0 0 0 4.24 4.24" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <CaptchaField key={captchaKey} value={captcha} onChange={setCaptcha} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
        >
          {loading && <Spinner className="w-4 h-4" />}
          {loading ? "در حال ورود..." : "ورود"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <span className="flex-1 border-t cut-line" />
        <span className="text-xs text-[var(--color-muted)]">یا</span>
        <span className="flex-1 border-t cut-line" />
      </div>

      <button
        onClick={() => {
          ensureDeviceCookie();
          signIn("google", { callbackUrl });
        }}
        className="w-full border cut-line py-2.5 rounded-full font-medium bg-white"
      >
        ورود با گوگل
      </button>

      <p className="text-sm text-center mt-6 text-[var(--color-muted)]">
        حساب ندارید؟{" "}
        <Link href="/auth/register" className="text-[var(--color-wine)] font-medium">
          ثبت‌نام کنید
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "خطایی پیش آمد");
      return;
    }

    setSubmitted(true);
    setDevResetLink(data.devResetLink ?? null);
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-2 text-center">فراموشی رمز عبور</h1>
      <p className="text-sm text-[var(--color-muted)] text-center mb-6">
        ایمیلی که باهاش ثبت‌نام کردی رو وارد کن.
      </p>

      {submitted ? (
        <div className="space-y-4">
          <p className="text-sm bg-[var(--color-linen-dim)] rounded-lg p-3">
            اگه این ایمیل توی سیستم ثبت شده باشه، لینک بازیابی رمز براش ساخته شد.
          </p>

          {devResetLink && (
            <div className="border-2 cut-line rounded-lg p-3 bg-white">
              <p className="text-xs font-bold text-[var(--color-ochre)] mb-1">
                🛠️ حالت توسعه — سرویس ایمیل واقعی وصل نیست
              </p>
              <p className="text-xs text-[var(--color-muted)] mb-2">
                توی نسخه‌ی نهایی، این لینک به ایمیل کاربر ارسال می‌شه. فعلاً برای تست، خودش رو اینجا می‌بینی:
              </p>
              <Link
                href={devResetLink}
                className="text-xs text-[var(--color-wine)] font-medium break-all underline"
              >
                {devResetLink}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
          >
            {loading ? "در حال ارسال..." : "ارسال لینک بازیابی"}
          </button>
        </form>
      )}

      <p className="text-sm text-center mt-6 text-[var(--color-muted)]">
        <Link href="/auth/login" className="text-[var(--color-wine)] font-medium">
          بازگشت به ورود
        </Link>
      </p>
    </div>
  );
}

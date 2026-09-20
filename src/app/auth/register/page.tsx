"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ensureDeviceCookie } from "@/lib/clientDevice";
import { CaptchaField, type CaptchaValue } from "@/components/CaptchaField";
import { Spinner } from "@/components/Spinner";

function RegisterForm() {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref") ?? undefined;
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [captcha, setCaptcha] = useState<CaptchaValue>({ captchaId: "", captchaAnswer: "" });
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, referralCode, captchaId: captcha.captchaId, captchaAnswer: captcha.captchaAnswer }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "خطایی رخ داد");
      setCaptchaKey((k) => k + 1);
      setCaptcha({ captchaId: "", captchaAnswer: "" });
      setLoading(false);
      return;
    }

    // بعد از ثبت‌نام موفق، خودکار وارد می‌کنیم
    ensureDeviceCookie();
    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    window.location.href = "/";
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-6 text-center">ثبت‌نام در مُداشاپ</h1>

      {referralCode && (
        <p className="text-sm text-center mb-4 text-[var(--color-wine)] bg-[var(--color-linen-dim)] rounded-lg py-2 px-3">
          با کد معرفی {referralCode} ثبت‌نام می‌کنید
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">نام</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ایمیل</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">رمز عبور</label>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white"
          />
        </div>

        <CaptchaField key={captchaKey} value={captcha} onChange={setCaptcha} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
        >
          {loading && <Spinner className="w-4 h-4" />}
          {loading ? "در حال ثبت‌نام..." : "ثبت‌نام"}
        </button>
      </form>

      <p className="text-sm text-center mt-6 text-[var(--color-muted)]">
        قبلاً ثبت‌نام کرده‌اید؟{" "}
        <Link href="/auth/login" className="text-[var(--color-wine)] font-medium">
          وارد شوید
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

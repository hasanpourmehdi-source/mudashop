"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("رمز عبور و تکرارش یکی نیستن");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "خطایی پیش آمد");
      return;
    }

    setDone(true);
  }

  if (!token) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <p className="text-sm text-red-600 mb-4">لینک بازیابی نامعتبره.</p>
        <Link href="/auth/forgot-password" className="text-[var(--color-wine)] font-medium text-sm">
          درخواست لینک جدید
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <p className="text-sm bg-[var(--color-linen-dim)] rounded-lg p-3 mb-4">
          رمز عبورت با موفقیت عوض شد.
        </p>
        <Link
          href="/auth/login"
          className="inline-block bg-[var(--color-wine)] text-white px-6 py-2.5 rounded-full font-medium text-sm"
        >
          ورود با رمز جدید
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-6 text-center">تعیین رمز جدید</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">رمز عبور جدید</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">تکرار رمز عبور</label>
          <input
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
        >
          {loading ? "در حال ثبت..." : "ثبت رمز جدید"}
        </button>
      </form>
    </div>
  );
}

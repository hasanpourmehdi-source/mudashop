"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("لینک تأیید نامعتبره.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setError(data.error ?? "خطایی پیش آمد");
          return;
        }
        setStatus("success");
      })
      .catch(() => {
        setStatus("error");
        setError("خطایی پیش آمد");
      });
  }, [token]);

  return (
    <div className="max-w-sm mx-auto px-4 py-16 text-center">
      {status === "loading" && <p className="text-sm text-[var(--color-muted)]">در حال بررسی...</p>}

      {status === "success" && (
        <>
          <p className="text-sm bg-[var(--color-linen-dim)] rounded-lg p-3 mb-4">
            ایمیلت با موفقیت تأیید شد. ✅
          </p>
          <Link
            href="/profile"
            className="inline-block bg-[var(--color-wine)] text-white px-6 py-2.5 rounded-full font-medium text-sm"
          >
            بازگشت به پروفایل
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Link href="/profile" className="text-[var(--color-wine)] font-medium text-sm">
            بازگشت به پروفایل
          </Link>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

// یادآوریِ نرم (نه مانع) -- ورود/خرید رو قفل نمی‌کنه، فقط یادآوری می‌کنه که
// اگه ایمیلش رو تأیید نکنه، ممکنه اعلان‌های مهم (تأیید سفارش، بازیابی رمز) رو
// اگه ایمیلش رو اشتباه وارد کرده باشه هیچ‌وقت نبینه
export function EmailVerificationBanner() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleResend() {
    setSending(true);
    setError("");
    const res = await fetch("/api/auth/send-verification", { method: "POST" });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "ارسال ناموفق بود");
      return;
    }
    setSent(true);
  }

  return (
    <div className="border cut-line rounded-lg p-4 bg-amber-50 text-sm space-y-2">
      <p className="font-medium">
        ⚠️ ایمیلت هنوز تأیید نشده. اگه اشتباه واردش کرده باشی، اعلان‌های سفارش/بازیابی رمز بهت نمی‌رسه.
      </p>
      {sent ? (
        <p className="text-xs text-green-700">ایمیل تأیید دوباره فرستاده شد -- صندوق ورودیت رو چک کن.</p>
      ) : (
        <button
          onClick={handleResend}
          disabled={sending}
          className="text-xs font-medium text-[var(--color-wine)] hover:underline disabled:opacity-50"
        >
          {sending ? "در حال ارسال..." : "ارسال دوباره‌ی ایمیل تأیید"}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnalyticsScripts } from "@/components/AnalyticsScripts";
import { getCookieConsent, setCookieConsent, type CookieConsent } from "@/lib/cookieConsent";

// اسکریپت‌های تبلیغاتی (GA4/متا پیکسل) فقط وقتی لود می‌شن که کاربر صراحتاً
// «قبول دارم» رو زده باشه -- نه به‌صورت پیش‌فرض. تا وقتی تصمیمی نگرفته، بنر
// پایین صفحه نشون داده می‌شه.
export function CookieConsentGate() {
  const [consent, setConsentState] = useState<CookieConsent>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsentState(getCookieConsent());
    setHydrated(true);
  }, []);

  function handle(value: "accepted" | "rejected") {
    setCookieConsent(value);
    setConsentState(value);
  }

  return (
    <>
      {consent === "accepted" && <AnalyticsScripts />}

      {hydrated && consent === null && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t cut-line p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <p className="text-xs text-[var(--color-muted)] max-w-xl">
            برای نمایش تبلیغات مرتبط‌تر، از کوکی استفاده می‌کنیم. جزئیات را در{" "}
            <Link href="/privacy" className="text-[var(--color-wine)] hover:underline">
              حریم خصوصی
            </Link>{" "}
            ببینید.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handle("rejected")}
              className="text-xs px-4 py-2 rounded-full border cut-line hover:bg-[var(--color-linen-dim)]"
            >
              رد می‌کنم
            </button>
            <button
              onClick={() => handle("accepted")}
              className="text-xs px-4 py-2 rounded-full bg-[var(--color-wine)] text-white font-medium"
            >
              قبول دارم
            </button>
          </div>
        </div>
      )}
    </>
  );
}

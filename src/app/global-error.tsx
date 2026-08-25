"use client";

import { useEffect } from "react";

// فایلِ ویژه‌ی Next.js -- وقتی خطایی حتی از layout.tsx هم رد بشه (کرش کامل)،
// این جایگزینِ کل صفحه می‌شه، پس خودش باید html/body داشته باشه. استایلِ
// این‌لاین عمداً به‌جای کلاسِ Tailwind استفاده شده چون globals.css ممکنه لود
// نشده باشه (وقتی همین‌جا کار می‌کنیم یعنی یه‌جای اساسی خراب شده).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/errors/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body style={{ fontFamily: "Tahoma, sans-serif", margin: 0 }}>
        <div
          style={{
            maxWidth: 420,
            margin: "80px auto",
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>مشکلی پیش اومد</p>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
            یه خطای غیرمنتظره رخ داد. تیم فنی از این موضوع خبردار شد.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#f27a1a",
              color: "white",
              border: "none",
              borderRadius: 999,
              padding: "10px 24px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}

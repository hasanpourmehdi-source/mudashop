"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseTrackingCodes } from "@/lib/trackingCodes";
import { parsePackageStatuses } from "@/lib/packageStatuses";

// مدیریت تحویل جزئی/چند بسته برای ادمین: هر بسته با دکمه‌ی «تحویل داده شد».
// وقتی همه‌ی بسته‌ها تحویل بشن، سرور کل سفارش رو DELIVERED می‌کنه.
export function AdminPackageArrival({
  orderId,
  status,
  trackingCode,
  packageStatuses,
}: {
  orderId: string;
  status: string;
  trackingCode: string | null;
  packageStatuses: string | null;
}) {
  const router = useRouter();
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (status !== "SHIPPED") return null;

  const codes = parseTrackingCodes(trackingCode);
  const statusByCode = new Map(parsePackageStatuses(packageStatuses).map((s) => [s.code, s]));
  if (codes.length === 0) return null;

  const allArrived = codes.every((c) => statusByCode.get(c)?.status === "ARRIVED");
  if (allArrived) return null;

  async function markArrived(code: string) {
    setBusyCode(code);
    setError("");
    const res = await fetch(`/api/admin/orders/${orderId}/packages/arrive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت تحویل بسته");
    }
    setBusyCode(null);
  }

  return (
    <div className="border cut-line rounded-lg p-4 bg-white">
      <h3 className="text-sm font-bold mb-3">📦 تحویل بسته‌ها</h3>
      <ul className="space-y-2">
        {codes.map((code, i) => {
          const st = statusByCode.get(code);
          const arrived = st?.status === "ARRIVED";
          return (
            <li key={code} className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-muted)]">بسته {i + 1}:</span>
              <span dir="ltr" className="font-mono text-xs">
                {code}
              </span>
              {arrived ? (
                <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                  تحویل داده شد ✓
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busyCode !== null}
                  onClick={() => markArrived(code)}
                  className="bg-[var(--color-wine)] text-white text-xs px-3 py-1 rounded-full disabled:opacity-50"
                >
                  {busyCode === code ? "ثبت..." : "تحویل داده شد"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-[10px] text-[var(--color-muted)] mt-2">
        وقتی همه‌ی بسته‌ها تحویل داده شوند، سفارش به‌صورت خودکار «تحویل‌شده» ثبت می‌شود.
      </p>
    </div>
  );
}
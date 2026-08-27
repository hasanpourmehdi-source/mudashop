"use client";

import { useEffect, useState } from "react";

const SIZE_ROWS = [
  { size: "S", chest: "88-92", waist: "70-74", length: "64" },
  { size: "M", chest: "92-96", waist: "74-78", length: "66" },
  { size: "L", chest: "96-102", waist: "78-84", length: "68" },
  { size: "XL", chest: "102-108", waist: "84-90", length: "70" },
];

export function SizeGuideModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-[var(--color-wine)] font-medium underline underline-offset-2"
      >
        راهنمای سایز
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-guide-title"
            className="bg-white rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="size-guide-title" className="font-bold">راهنمای سایز</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                aria-label="بستن"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--color-muted)] mb-4">
              اندازه‌ها به سانتی‌متر و تقریبی‌ان — ممکنه بسته به مدل کمی متفاوت باشن.
            </p>
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="border-b cut-line">
                  <th className="py-2 font-medium">سایز</th>
                  <th className="py-2 font-medium">دور سینه</th>
                  <th className="py-2 font-medium">دور کمر</th>
                  <th className="py-2 font-medium">قد</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_ROWS.map((row) => (
                  <tr key={row.size} className="border-b cut-line last:border-0">
                    <td className="py-2 font-bold text-[var(--color-wine)]">{row.size}</td>
                    <td className="py-2">{row.chest}</td>
                    <td className="py-2">{row.waist}</td>
                    <td className="py-2">{row.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

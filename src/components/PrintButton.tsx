"use client";

// دکمه‌ی چاپ/ذخیره PDF -- جدا تا هم در صفحه‌ی مستقل فاکتور و هم در مودال‌ها
// (پیش‌فاکتور سبد) قابل استفاده باشد
export function PrintButton({ label = "چاپ / ذخیره PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-[var(--color-wine)] text-white px-5 py-2 rounded-full font-medium hover:bg-[var(--color-wine-dark)] transition-colors"
    >
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden="true">
        <path
          d="M6 7V3h8v4m-8 0h8m-9 3h.01M5 14H3V7h14v7h-2m-8 0h8v3H7v-3Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </button>
  );
}
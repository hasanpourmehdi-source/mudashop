"use client";

import { useSyncExternalStore } from "react";

// چیدمانِ موبایلِ لیستِ محصولات: ۱ یا ۲ محصول در هر ردیف (از sm به بالا همان چندستونه‌ی
// قبلی می‌ماند). انتخابِ کاربر توی localStorage می‌ماند و بینِ همه‌ی لیست‌ها مشترک است
const STORAGE_KEY = "mudashop:gridMobileColumns";
const CHANGE_EVENT = "mudashop:gridMobileColumns-change";

type Columns = 1 | 2;

function readColumns(): Columns {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1" ? 1 : 2;
  } catch {
    return 2;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useMobileColumns(): Columns {
  // سمتِ سرور همیشه ۲ (پیش‌فرض) -- بعد از hydrate مقدارِ ذخیره‌شده اعمال می‌شود
  return useSyncExternalStore(subscribe, readColumns, () => 2);
}

function setColumns(value: Columns) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // حالتِ خصوصی/بلاک‌شده -- فقط برای همین بازدید اعمال می‌شود
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// دکمه‌ی نمایش (فقط موبایل) -- بالای لیست‌ها
export function GridViewToggle({ className = "" }: { className?: string }) {
  const columns = useMobileColumns();
  const option = (value: Columns, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setColumns(value)}
      aria-label={label}
      aria-pressed={columns === value}
      title={label}
      className={`w-8 h-8 flex items-center justify-center transition-colors ${
        columns === value ? "bg-[var(--color-wine)] text-white" : "bg-white text-[var(--color-muted)]"
      }`}
    >
      {icon}
    </button>
  );
  return (
    <div
      role="group"
      aria-label="نحوه‌ی نمایش محصولات"
      className={`sm:hidden inline-flex border cut-line rounded-lg overflow-hidden shrink-0 ${className}`}
    >
      {option(
        1,
        "نمایش ۱ محصول در هر ردیف",
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="2" width="12" height="5" rx="1" />
          <rect x="2" y="9" width="12" height="5" rx="1" />
        </svg>
      )}
      {option(
        2,
        "نمایش ۲ محصول در هر ردیف",
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      )}
    </div>
  );
}

// شبکه‌ی محصولات -- className فقط ستون‌های sm به بالا و فاصله‌ها (مثلاً "sm:grid-cols-3 gap-4")
export function ProductGrid({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const columns = useMobileColumns();
  return <div className={`grid ${columns === 1 ? "grid-cols-1" : "grid-cols-2"} ${className}`}>{children}</div>;
}

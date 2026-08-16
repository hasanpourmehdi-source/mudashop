"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

const SORT_OPTIONS: { id: string; label: string }[] = [
  { id: "SCORE", label: "پیشنهادی" },
  { id: "PRICE_BY_ASC", label: "کم‌ترین قیمت" },
  { id: "PRICE_BY_DESC", label: "بیشترین قیمت" },
  { id: "MOST_RECENT", label: "جدیدترین" },
  { id: "BEST_SELLER", label: "پرفروش‌ترین" },
  { id: "MOST_FAVOURITE", label: "محبوب‌ترین" },
  { id: "MOST_RATED", label: "پرامتیازترین" },
];

// دقیقاً همون گزینه‌های صفحه‌ی محصولات ترندیول، با همون پارامتر واقعی sst=
export function TrendyolSortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const currentSst = searchParams.get("sst") ?? "SCORE";
  const currentLabel = SORT_OPTIONS.find((o) => o.id === currentSst)?.label ?? "پیشنهادی";

  function selectSort(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "SCORE") params.delete("sst");
    else params.set("sst", id);
    setOpen(false);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="relative inline-block text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border cut-line rounded-lg px-3 py-2 bg-white hover:border-[var(--color-wine)]"
      >
        {currentLabel}
        <span className="text-xs text-[var(--color-muted)]">↕</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute left-0 mt-1 z-20 bg-white border cut-line rounded-lg shadow-md min-w-[180px] py-1">
            {SORT_OPTIONS.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => selectSort(opt.id)}
                  className={`w-full text-right px-3 py-2 text-sm hover:bg-[var(--color-linen-dim)] ${
                    opt.id === currentSst ? "text-[var(--color-wine)] font-bold" : ""
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

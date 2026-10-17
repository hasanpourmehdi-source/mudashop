"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Spinner } from "@/components/Spinner";

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
// includeDiscountSort: «بیشترین تخفیف» یه مرتب‌سازیِ مجازیه (sst=DISCOUNT) که فقط
// صفحه‌ی دسته‌بندیِ مارکت‌پلیس پشتیبانیش می‌کنه -- بقیه‌ی صفحه‌ها (سرچ، کمپین، ...) نه
export function TrendyolSortDropdown({ includeDiscountSort = false }: { includeDiscountSort?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const options = includeDiscountSort ? [...SORT_OPTIONS, { id: "DISCOUNT", label: "بیشترین تخفیف" }] : SORT_OPTIONS;
  const currentSst = searchParams.get("sst") ?? "SCORE";
  const currentLabel = options.find((o) => o.id === currentSst)?.label ?? "پیشنهادی";

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
        disabled={isPending}
        className="flex items-center gap-2 border cut-line rounded-lg px-3 py-2 bg-white hover:border-[var(--color-wine)] disabled:opacity-60"
      >
        {isPending && <Spinner className="w-3.5 h-3.5" />}
        {currentLabel}
        <span className="text-xs text-[var(--color-muted)]">↕</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          {/* z-40 -- بالاتر از هرچی توی گریدِ محصولات هست (مثلاً دکمه‌ی
              «نگاه سریع» با z-20)، وگرنه با هاورِ یه کارتِ زیرِ همین منو، اون
              دکمه روی خودِ لیستِ باز بازِ مرتب‌سازی می‌نشست */}
          <ul className="absolute left-0 mt-1 z-40 bg-white border cut-line rounded-lg shadow-md min-w-[180px] py-1">
            {options.map((opt) => (
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

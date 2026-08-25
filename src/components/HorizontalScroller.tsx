"use client";

import { useRef } from "react";

// نوارِ اسکرولِ افقیِ مشترک برای همه‌ی ردیف‌های محصول/کمپین توی صفحه‌ی اصلی --
// یه کمی فاصله از لبه‌ی اول/آخر (تا کارت‌ها به لبه‌ی کانتینر نچسبن) + دو دکمه‌ی
// فلش برای اسکرول‌کردن با کلیک، نه فقط کشیدنِ موس/تاچ‌پد. هر دکمه فقط سمتِ
// خودش رو اسکرول می‌کنه (بدون فرض درباره‌ی RTL/LTR -- scrollBy همیشه بر اساسِ
// جهتِ واقعیِ صفحه‌ست، نه جهتِ منطقیِ متن)
export function HorizontalScroller({
  children,
  className = "px-4 -mx-4 pb-1",
}: {
  children: React.ReactNode;
  // پیش‌فرض یه فاصله‌ی ۴ (با -mx-4 جبران‌شده تا لبه‌ی بصری عوض نشه) از هر دو طرف
  // اضافه می‌کند تا کارت‌های اول/آخر به لبه‌ی کانتینر نچسبند؛ اگه کانتینرِ
  // بیرونی خودش پدینگِ متفاوتی دارد (مثلاً بنرِ حراج فلش)، این کلاس رو عوض کن
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function scrollBySide(direction: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative group/scroller">
      <button
        type="button"
        onClick={() => scrollBySide(-1)}
        aria-label="اسکرول به چپ"
        className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border cut-line shadow items-center justify-center opacity-0 group-hover/scroller:opacity-100 transition-opacity hover:border-[var(--color-wine)]"
      >
        ‹
      </button>
      <div
        ref={ref}
        className={`flex gap-4 overflow-x-auto scrollbar-hide px-4 -mx-4 pb-1 ${className ?? ""}`}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollBySide(1)}
        aria-label="اسکرول به راست"
        className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border cut-line shadow items-center justify-center opacity-0 group-hover/scroller:opacity-100 transition-opacity hover:border-[var(--color-wine)]"
      >
        ›
      </button>
    </div>
  );
}

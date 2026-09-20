"use client";

import { useEffect, useRef, useState } from "react";

// نوارِ اسکرولِ افقیِ مشترک برای همه‌ی ردیف‌های محصول/کمپین توی صفحه‌ی اصلی --
// یه کمی فاصله از لبه‌ی اول/آخر (تا کارت‌ها به لبه‌ی کانتینر نچسبن) + دو دکمه‌ی
// فلشِ گردِ رنگی (شبیهِ دکمه‌های ترندیول) برای اسکرول‌کردن با کلیک، نه فقط
// کشیدنِ موس/تاچ‌پد.
//
// دو تا مسئله‌ی جدا اینجا حل شده، هر دو بدون فرض درباره‌ی قراردادِ scrollLeft
// مرورگر برای کانتینرهای RTL (که بینِ مرورگرها یکسان نیست):
//  ۱) کدوم دکمه باید «قبلی»/«بعدی» باشه -- با اندازه‌گیریِ موقعیتِ واقعیِ
//     اولین/آخرین فرزند (نه با فرضِ علامتِ اسکرول).
//  ۲) کِی دکمه‌ی ابتدا/انتها باید مخفی بشه -- با IntersectionObserver روی خودِ
//     اولین/آخرین فرزند (کاملاً دیده شدن = دیگه چیزی برای اسکرول‌کردن نیست)،
//     نه با مقایسه‌ی مختصاتِ raw که برای RTL گمراه‌کننده‌ست.
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
  const trackRef = useRef<HTMLDivElement>(null);
  // جهتِ واقعیِ محتوا -- true یعنی فرزندِ آخر سمتِ چپِ فرزندِ اول قرار داره
  // (حالتِ معمولِ RTL)، false یعنی برعکس (مثلاً یه بلاکِ LTR تو دلِ صفحه)
  const contentGoesLeftRef = useRef(true);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    if (kids.length < 2) {
      setAtStart(true);
      setAtEnd(true);
      return;
    }
    const first = kids[0];
    const last = kids[kids.length - 1];
    contentGoesLeftRef.current = last.getBoundingClientRect().left < first.getBoundingClientRect().left;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const fullyVisible = entry.intersectionRatio >= 0.98;
          if (entry.target === first) setAtStart(fullyVisible);
          if (entry.target === last) setAtEnd(fullyVisible);
        }
      },
      { root: el, threshold: [0, 0.98, 1] }
    );
    observer.observe(first);
    observer.observe(last);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToward(side: "prev" | "next") {
    const el = trackRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    const goingLeftMeansNext = contentGoesLeftRef.current;
    const sign = side === "next" ? (goingLeftMeansNext ? -1 : 1) : goingLeftMeansNext ? 1 : -1;
    el.scrollBy({ left: sign * amount, behavior: "smooth" });
  }

  return (
    <div className="relative group/scroller">
      {!atStart && (
        <button
          type="button"
          onClick={() => scrollToward("prev")}
          aria-label="مشاهده موارد قبلی"
          className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[var(--color-wine)] text-white shadow-lg items-center justify-center opacity-0 group-hover/scroller:opacity-100 transition-all hover:scale-105"
        >
          <ChevronIcon direction="left" />
        </button>
      )}
      <div
        ref={trackRef}
        className={`flex gap-4 overflow-x-auto scrollbar-hide px-4 -mx-4 pb-1 ${className ?? ""}`}
      >
        {children}
      </div>
      {!atEnd && (
        <button
          type="button"
          onClick={() => scrollToward("next")}
          aria-label="مشاهده موارد بعدی"
          className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[var(--color-wine)] text-white shadow-lg items-center justify-center opacity-0 group-hover/scroller:opacity-100 transition-all hover:scale-105"
        >
          <ChevronIcon direction="right" />
        </button>
      )}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

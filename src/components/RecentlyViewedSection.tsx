"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { HorizontalScroller } from "@/components/HorizontalScroller";

// نوار «اخیراً دیدهاید» -- فقط بعد از mount رندر می‌شه تا hydration mismatch
// پیش نیاد (داده از localStorage میاد که سمت سرور در دسترس نیست)
export function RecentlyViewedSection() {
  const { items, remove } = useRecentlyViewed();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (items.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">🕘 اخیراً دیده‌اید</h2>
        <Link
          href="/recently-viewed"
          className="text-sm font-medium text-[var(--color-wine)] hover:underline flex items-center gap-1"
        >
          مشاهده همه ‹
        </Link>
      </div>
      <HorizontalScroller className="px-4 -mx-4 pb-2 snap-x snap-mandatory scroll-smooth">
        {items.map((p) => (
          <div key={p.id} className="relative w-40 shrink-0 snap-start group">
            <Link
              href={p.href}
              className="flex flex-col h-full border cut-line rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-[3/4] shrink-0 bg-[var(--color-linen-dim)] overflow-hidden">
                {p.image && (
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="160px"
                    unoptimized
                  />
                )}
                {p.discount > 0 && (
                  <span className="ribbon-tag absolute top-2 left-0 font-bold">{p.discount}%</span>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-sm font-medium line-clamp-2 mb-1.5 min-h-[2.5rem]">{p.title}</h3>
                <div className="flex items-baseline gap-2 flex-wrap mt-auto">
                  {/* whitespace-nowrap لازمه چون توی کارتِ باریک (w-40)، بدونش عددِ
                      قیمت از خودِ کلمه‌ی «تومان» جدا می‌شه و به خط بعد می‌ره --
                      اگه قیمتِ خط‌خورده هم جا نشه، خودش (کامل) می‌ره خط بعد، نه
                      این‌که وسطِ عددِ قیمتِ اصلی بشکنه */}
                  <span className="font-bold text-[var(--color-wine)] text-sm whitespace-nowrap">
                    {p.price.toLocaleString("fa-IR")} تومان
                  </span>
                  {p.discount > 0 && (
                    <span className="text-xs text-[var(--color-muted)] line-through whitespace-nowrap">
                      {p.originalPrice.toLocaleString("fa-IR")}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => remove(p.id)}
              aria-label="حذف از اخیراً دیدهاید"
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 border cut-line text-[var(--color-muted)] text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-[var(--color-wine)] transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
      </HorizontalScroller>
    </section>
  );
}
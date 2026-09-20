"use client";

import { useState } from "react";
import Link from "next/link";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import type { VideoWallItem } from "@/lib/videoWall";

// یه ردیفِ افقی از همه‌ی ویدیوهای محصولات (رسمیِ مزون + ویدیوهایی که مشتری‌ها
// ضمیمه‌ی نظرشون کردن، چه مزون چه ترندیول/میلا) -- کلیک روی هرکدوم توی یه
// پاپ‌آپ پخش می‌شه، با یه دکمه‌ی «مشاهده و خرید محصول» که به همون صفحه لینک می‌ده
export function VideoWallSection({ items }: { items: VideoWallItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((i) => i.id === openId) ?? null;

  if (items.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 py-8">
      <h2 className="font-bold text-lg mb-4">🎬 فیلم محصولات</h2>
      <HorizontalScroller>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenId(item.id)}
            className="relative shrink-0 w-32 aspect-[3/4] rounded-xl overflow-hidden bg-black border cut-line"
          >
            <video src={item.videoUrl} muted preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white text-2xl">▶</span>
            <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[11px] px-2 py-1.5 line-clamp-2 text-right">
              {item.title}
            </span>
          </button>
        ))}
      </HorizontalScroller>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={open.title}
            className="bg-white rounded-2xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[3/4] bg-black">
              <video src={open.videoUrl} controls autoPlay className="absolute inset-0 w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="بستن"
                className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-sm font-medium">{open.title}</p>
              <Link
                href={open.href}
                className="block text-center bg-[var(--color-wine)] text-white rounded-full py-2 text-sm font-medium"
              >
                مشاهده و خرید محصول
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

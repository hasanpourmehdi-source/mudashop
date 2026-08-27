"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useColorSync } from "@/components/ColorSyncProvider";

const ZOOM_FACTOR = 2.2; // چقدر عکس توی پنل بزرگنمایی، بزرگ‌تر از حالت عادی نشون داده بشه
const LENS_SIZE_PERCENT = 100 / ZOOM_FACTOR; // اندازه‌ی مربع لنز نسبت به کل عکس

export function ProductGallery({
  images,
  title,
  colorImages,
  videoUrl,
}: {
  images: string[];
  title: string;
  colorImages?: Record<string, string[]>;
  videoUrl?: string | null;
}) {
  const { selectedColor } = useColorSync();
  const [active, setActive] = useState<number | "video">(0);
  const [isZooming, setIsZooming] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 50, y: 50 }); // درصد -- مرکز مربع لنز
  const containerRef = useRef<HTMLDivElement>(null);

  // اگه برای رنگ انتخاب‌شده عکس اختصاصی تعریف شده باشه، همونا رو نشون بده -- وگرنه عکس‌های پیش‌فرض محصول
  const colorSpecificImages =
    selectedColor && colorImages?.[selectedColor]?.length ? colorImages[selectedColor] : null;
  const activeImages = colorSpecificImages ?? images;

  // با عوض شدن ست عکس‌ها (مثلا با تغییر رنگ)، برگرد به عکس اول همون ست
  useEffect(() => {
    setActive(0);
  }, [colorSpecificImages]);

  const isVideoActive = active === "video";
  const current = isVideoActive ? undefined : activeImages[active as number] ?? activeImages[0];

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    // مربع لنز نباید از لبه‌ی عکس بزنه بیرون
    const half = LENS_SIZE_PERCENT / 2;
    setLensPos({
      x: Math.min(Math.max(xPercent, half), 100 - half),
      y: Math.min(Math.max(yPercent, half), 100 - half),
    });
  }

  // درصد پس‌زمینه‌ی پنل بزرگنمایی -- طوری که همون نقطه‌ی زیر لنز، وسط پنل بیفته
  const bgPosX = ((lensPos.x - LENS_SIZE_PERCENT / 2) / (100 - LENS_SIZE_PERCENT)) * 100;
  const bgPosY = ((lensPos.y - LENS_SIZE_PERCENT / 2) / (100 - LENS_SIZE_PERCENT)) * 100;
  const rect = containerRef.current?.getBoundingClientRect();

  return (
    <div className="max-w-[440px] mx-auto md:mx-0">
      <div
        ref={containerRef}
        className={`relative aspect-[3/4] bg-[var(--color-linen-dim)] rounded-xl overflow-hidden ${
          isVideoActive ? "" : "cursor-zoom-in"
        }`}
        onMouseEnter={() => !isVideoActive && setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={handleMouseMove}
      >
        {isVideoActive && videoUrl ? (
          <video src={videoUrl} controls className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          current && <Image src={current} alt={title} fill className="object-contain" unoptimized priority />
        )}

        {/* مربع لنز -- فقط توی دسکتاپ، همون‌جا روی خود عکس */}
        {isZooming && current && (
          <div
            className="hidden lg:block absolute border-2 border-white bg-white/20 pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
            style={{
              width: `${LENS_SIZE_PERCENT}%`,
              height: `${LENS_SIZE_PERCENT}%`,
              left: `${lensPos.x}%`,
              top: `${lensPos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>

      {/* پنل بزرگنمایی -- کنار عکس اصلی (سمت چپش)، فقط دسکتاپ، فقط وقتی هاوره */}
      {isZooming && current && rect && (
        <div
          className="hidden lg:block fixed z-40 border cut-line rounded-xl shadow-lg pointer-events-none"
          style={{
            width: "480px",
            height: "480px",
            top: rect.top,
            left: Math.max(rect.left - 496, 8),
            backgroundColor: "var(--color-linen-dim)",
            backgroundImage: `url(${current})`,
            backgroundSize: `${ZOOM_FACTOR * 100}%`,
            backgroundPosition: `${bgPosX}% ${bgPosY}%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}

      {(activeImages.length > 1 || videoUrl) && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {activeImages.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 ${
                i === active ? "border-[var(--color-wine)]" : "border-transparent"
              }`}
            >
              <Image src={src} alt="" fill className="object-cover" unoptimized />
            </button>
          ))}
          {videoUrl && (
            <button
              type="button"
              onClick={() => setActive("video")}
              className={`relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 bg-black ${
                isVideoActive ? "border-[var(--color-wine)]" : "border-transparent"
              }`}
            >
              <video src={videoUrl} muted preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xl">▶</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

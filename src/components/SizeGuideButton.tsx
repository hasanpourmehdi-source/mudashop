"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { recommendSize, type SizeChartRowLike } from "@/lib/sizeRecommend";

export function SizeGuideButton({ imageUrl, sizeGuideId }: { imageUrl: string; sizeGuideId?: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SizeChartRowLike[]>([]);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (!open || !sizeGuideId) return;
    fetch(`/api/size-guides/${sizeGuideId}/rows`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setRows);
  }, [open, sizeGuideId]);

  const h = Number(height);
  const w = Number(weight);
  const recommendation =
    h > 0 && w > 0 && rows.length > 0 ? recommendSize(rows, h, w) : null;

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--color-wine)] hover:underline w-fit flex items-center gap-1"
      >
        📏 راهنمای سایز
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-2 left-2 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-sm"
            >
              ✕
            </button>
            <div className="relative w-full" style={{ minHeight: 300 }}>
              <Image
                src={imageUrl}
                alt="راهنمای سایز"
                width={800}
                height={800}
                className="w-full h-auto rounded"
                unoptimized
              />
            </div>

            {rows.length > 0 && (
              <div className="mt-3 border-t cut-line pt-3 space-y-2">
                <p className="text-sm font-bold">پیشنهاد سایز بر اساس قد و وزن</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="قد (سانتی‌متر)"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm min-w-0"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="وزن (کیلوگرم)"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm min-w-0"
                  />
                </div>
                {recommendation && (
                  <p className="text-sm bg-[var(--color-linen-dim)] rounded-lg px-3 py-2">
                    سایزِ {recommendation.exact ? "پیشنهادی" : "تقریبی"} برای تو:{" "}
                    <span className="font-bold text-[var(--color-wine)]">{recommendation.sizeLabel}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

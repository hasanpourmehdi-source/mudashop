"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function SizeGuideButton({ imageUrl }: { imageUrl: string }) {
  const [open, setOpen] = useState(false);

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
          </div>
        </div>
      )}
    </>
  );
}

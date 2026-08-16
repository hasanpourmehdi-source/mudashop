"use client";

import { useState } from "react";
import Image from "next/image";

export function ImageListEditor({
  images,
  onChange,
  invalid = false,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  invalid?: boolean; // برای کادر قرمز وقتی حداقل یک عکس اجباریه و هنوز خالیه
}) {
  const [url, setUrl] = useState("");

  function handleAdd() {
    const trimmed = url.trim();
    if (!trimmed) return;
    onChange([...images, trimmed]);
    setUrl("");
  }

  function handleRemove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function moveFirst(index: number) {
    if (index === 0) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          placeholder="آدرس تصویر (URL)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className={`flex-1 border cut-line rounded-lg px-3 py-2 bg-white text-sm ${
            invalid ? "!border-red-600" : ""
          }`}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium shrink-0"
        >
          افزودن
        </button>
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative group">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border cut-line bg-[var(--color-linen-dim)]">
                <Image src={src} alt="" fill className="object-cover" unoptimized />
              </div>
              {i === 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[var(--color-wine)] text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  اصلی
                </span>
              )}
              <div className="flex gap-1 mt-1 justify-center">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => moveFirst(i)}
                    className="text-[9px] text-[var(--color-wine)] hover:underline"
                  >
                    اصلی کن
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="text-[9px] text-red-600 hover:underline"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {images.length === 0 && (
        <p className="text-xs text-[var(--color-ochre)]">حداقل یک تصویر لازم است.</p>
      )}
    </div>
  );
}

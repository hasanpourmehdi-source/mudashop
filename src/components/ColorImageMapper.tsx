"use client";

import Image from "next/image";

export function ColorImageMapper({
  images,
  colorValues,
  value,
  onChange,
}: {
  images: string[]; // همه‌ی عکس‌های آپلودشده‌ی این محصول
  colorValues: string[]; // مقادیر متمایز ویژگی رنگ که از روی وارینت‌ها تشخیص داده شده
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
}) {
  if (colorValues.length === 0 || images.length === 0) return null;

  function toggle(color: string, img: string) {
    const current = value[color] ?? [];
    const next = current.includes(img)
      ? current.filter((i) => i !== img)
      : [...current, img];
    onChange({ ...value, [color]: next });
  }

  return (
    <div className="border cut-line rounded-lg p-3 space-y-3">
      <p className="text-xs font-medium">
        عکس اختصاصی هر رنگ <span className="text-[var(--color-muted)]">(اختیاری)</span>
      </p>
      <p className="text-[10px] text-[var(--color-muted)]">
        برای هر رنگ، عکس‌هایی که مخصوص همون رنگن رو تیک بزن. اگه برای یه رنگ هیچ عکسی
        انتخاب نکنی، همون گالری پیش‌فرض محصول نشون داده می‌شه.
      </p>
      {colorValues.map((color) => (
        <div key={color}>
          <p className="text-xs font-medium mb-1.5">{color}</p>
          <div className="flex flex-wrap gap-2">
            {images.map((img) => {
              const selected = (value[color] ?? []).includes(img);
              return (
                <button
                  key={img}
                  type="button"
                  onClick={() => toggle(color, img)}
                  className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 ${
                    selected ? "border-[var(--color-wine)]" : "border-transparent"
                  }`}
                >
                  <Image src={img} alt="" fill className="object-cover" unoptimized />
                  {selected && (
                    <span className="absolute inset-0 bg-[var(--color-wine)]/20 flex items-center justify-center">
                      <svg viewBox="0 0 20 20" className="w-5 h-5 fill-white drop-shadow">
                        <path d="M7.6 13.2 4.4 10l-1.2 1.2 4.4 4.4L17 6.2 15.8 5z" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

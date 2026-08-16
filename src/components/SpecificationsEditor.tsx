"use client";

import { useState } from "react";

export type SpecRow = { label: string; value: string };

export function SpecificationsEditor({
  specs,
  onChange,
}: {
  specs: SpecRow[];
  onChange: (specs: SpecRow[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");

  function handleAdd() {
    if (!label.trim() || !value.trim()) return;
    onChange([...specs, { label: label.trim(), value: value.trim() }]);
    setLabel("");
    setValue("");
  }

  function handleRemove(index: number) {
    onChange(specs.filter((_, i) => i !== index));
  }

  return (
    <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
      <p className="text-sm font-bold">مشخصات فنی (اختیاری)</p>
      <p className="text-[10px] text-[var(--color-muted)]">
        جفت‌های توصیفی مثل «جنس: کتان» یا «قد لباس: بلند» — فقط نمایشی‌ان، برای ساخت variant استفاده نمی‌شن.
      </p>

      {specs.length > 0 && (
        <div className="space-y-1.5">
          {specs.map((spec, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm border cut-line rounded-lg px-3 py-1.5"
            >
              <span>
                <span className="text-[var(--color-muted)]">{spec.label}:</span> {spec.value}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="text-red-600 hover:underline text-xs"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          placeholder="برچسب (مثلا جنس)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-sm"
        />
        <input
          placeholder="مقدار (مثلا کتان)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full text-sm font-medium shrink-0"
        >
          افزودن
        </button>
      </div>
    </div>
  );
}

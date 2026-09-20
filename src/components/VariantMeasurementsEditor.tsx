"use client";

import { useState } from "react";
import type { VariantMeasurement } from "@/lib/productMeasurements";

// اندازه‌ی واقعیِ فیزیکیِ یه ترکیبِ خاص (مثلاً سایز XL همین محصول) -- برخلافِ
// SpecificationsEditor (که یه کارتِ کاملِ محصوله)، این باید کنارِ هر ردیفِ
// variant جا بشه، پس جمع‌وجورِ toggle-ایه: یه دکمه که با کلیک، ویرایشگرِ
// جفت‌های برچسب+سانتی‌متر رو باز/بسته می‌کنه
export function VariantMeasurementsEditor({
  measurements,
  onChange,
}: {
  measurements: VariantMeasurement[];
  onChange: (measurements: VariantMeasurement[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [cm, setCm] = useState("");

  function handleAdd() {
    const cmNum = Number(cm);
    if (!label.trim() || !Number.isFinite(cmNum) || cmNum <= 0) return;
    onChange([...measurements, { label: label.trim(), cm: cmNum }]);
    setLabel("");
    setCm("");
  }

  function handleRemove(index: number) {
    onChange(measurements.filter((_, i) => i !== index));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-[var(--color-wine)] hover:underline shrink-0 whitespace-nowrap"
        title="اندازه‌ی واقعیِ این ترکیب (اختیاری)"
      >
        📏 {measurements.length > 0 ? measurements.length : "اندازه"}
      </button>

      {open && (
        <div className="absolute z-10 top-full mt-1 left-0 bg-white border cut-line rounded-lg p-3 shadow-lg w-64 space-y-2">
          <p className="text-[10px] text-[var(--color-muted)]">
            اندازه‌ی واقعیِ همین ترکیب به سانتی‌متر (مثلاً «دور کمر: ۷۸») -- اختیاری، فقط اگه بخوای مشتری اندازه‌ی دقیقِ این سایز رو ببینه.
          </p>
          {measurements.length > 0 && (
            <div className="space-y-1">
              {measurements.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs border cut-line rounded-lg px-2 py-1">
                  <span>
                    {m.label}: <span className="font-medium">{m.cm}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    className="text-red-600 hover:underline"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              placeholder="برچسب (دور کمر)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 min-w-0 border cut-line rounded-lg px-2 py-1 text-xs"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="سانتی‌متر"
              value={cm}
              onChange={(e) => setCm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="w-20 border cut-line rounded-lg px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="bg-[var(--color-wine)] text-white px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[10px] text-[var(--color-muted)] hover:underline"
          >
            بستن
          </button>
        </div>
      )}
    </div>
  );
}

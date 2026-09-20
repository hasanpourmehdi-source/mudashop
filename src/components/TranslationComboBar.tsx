"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  clearComboSelection,
  getComboSelectionSnapshot,
  subscribeComboSelection,
  toggleComboWord,
} from "@/lib/translationComboSelection";

// نوارِ شناورِ پایینِ صفحه -- فقط وقتی حداقل یه کلمه با Ctrl+کلیک انتخاب شده
// باشه دیده می‌شه. تکه‌های انتخاب‌شده رو (به ترتیبِ کلیکِ ادمین) پشتِ‌سرهم نشون
// می‌ده، ادمین قالبِ فارسیِ یکجاش رو می‌نویسه و به‌عنوان یه ردیفِ *چندکلمه‌ای* به
// همون دیکشنریِ عنوان/ویژگی اضافه می‌شه -- دقیقاً همون مکانیزمِ عبارت‌های
// چندکلمه‌ای که دیکشنری از قبل پشتیبانی می‌کنه، فقط این‌بار کلماتش لزوماً از
// یه TranslatableRun واحد نیومدن. فقط برای ادمین mount می‌شه (از layout اصلی)
export function TranslationComboBar({ isAdmin }: { isAdmin: boolean }) {
  const selected = useSyncExternalStore(
    subscribeComboSelection,
    getComboSelectionSnapshot,
    getComboSelectionSnapshot
  );
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isAdmin || selected.length === 0) return null;

  const termTr = selected.map((w) => w.termTr).join(" ");

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/trendyol-title-dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termTr, termFa: value.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "ذخیره نشد");
      return;
    }
    clearComboSelection();
    setValue("");
    router.refresh();
  }

  return (
    <div className="fixed bottom-20 sm:bottom-4 inset-x-4 sm:inset-x-auto sm:left-4 sm:right-auto z-50 sm:max-w-md">
      <div className="border cut-line rounded-2xl bg-white shadow-xl p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-[var(--color-muted)]">
            ترکیبِ {selected.length.toLocaleString("fa-IR")} کلمه‌ی انتخاب‌شده
          </p>
          <button
            type="button"
            onClick={clearComboSelection}
            className="text-xs text-[var(--color-muted)] hover:text-red-600"
          >
            لغوِ انتخاب
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5" dir="ltr">
          {selected.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => toggleComboWord(w)}
              title="حذف از انتخاب"
              className="text-xs font-mono bg-[var(--color-linen-dim)] border cut-line rounded px-1.5 py-0.5 hover:bg-red-50 hover:border-red-300"
            >
              {w.display}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="ترجمه‌ی فارسیِ یکجای این ترکیب"
            className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-sm min-w-0"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !value.trim()}
            className="shrink-0 bg-[var(--color-wine)] text-white rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {saving ? "..." : "ذخیره"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { FEATURE_CATALOG } from "@/lib/featureFlags";

export default function AdminFeatureFlagsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof FEATURE_CATALOG>();
    for (const f of FEATURE_CATALOG) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category)!.push(f);
    }
    return Array.from(map.entries());
  }, []);

  // فقط برای نمایشِ یه آیکنِ کوچیک کنارِ عنوانِ هر گروه -- کمک به اسکن‌کردنِ سریع
  const CATEGORY_ICONS: Record<string, string> = {
    "صفحه‌ی اصلی": "🏠",
    "صفحه‌ی محصول": "🏷️",
    سراسری: "🌐",
  };

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : Promise.resolve({} as Record<string, string>)))
      .then((data: Record<string, string>) => {
        setEnabled(
          Object.fromEntries(FEATURE_CATALOG.map((f) => [f.key, data[f.key] !== "false"]))
        );
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      for (const f of FEATURE_CATALOG) {
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: f.key, value: enabled[f.key] ? "true" : "false" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `خطا در ذخیره (کد ${res.status})`);
        }
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">امکانات فروشگاه</h1>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          هرکدوم از این قابلیت‌ها رو می‌شه جدا خاموش کرد تا سایت ساده‌تر و سبک‌تر بشه. پیش‌فرض همه روشنن
          (رفتارِ فعلی). قابلیت‌های اصلیِ سفارش/پرداخت/کیف‌پول اینجا نیستن -- فقط بخش‌های اختیاریِ کشف و مارکتینگ.
        </p>
      </div>

      {grouped.map(([category, items]) => (
        <div key={category} className="border cut-line rounded-lg p-4 bg-white space-y-3">
          <p className="text-sm font-bold flex items-center gap-1.5">
            <span>{CATEGORY_ICONS[category] ?? "📌"}</span>
            {category}
          </p>
          {items.map((f) => (
            <label key={f.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled[f.key] ?? true}
                onChange={(e) => setEnabled((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                className="mt-1"
              />
              <span>
                <span className="text-sm font-bold block">{f.label}</span>
                <span className="text-[11px] text-[var(--color-muted)]">{f.description}</span>
              </span>
            </label>
          ))}
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">ذخیره شد -- برای دیدنِ تغییرات صفحه رو رفرش کنید.</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
      >
        {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
      </button>
    </div>
  );
}

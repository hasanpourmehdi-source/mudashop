"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type CacheRow = {
  id: string;
  param: string;
  nameTr: string;
  nameFa: string | null;
  nameFaSuggested: boolean;
  path: string;
};

export default function TrendyolCategoriesAdminPage() {
  const [rows, setRows] = useState<CacheRow[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [untranslatedOnly, setUntranslatedOnly] = useState(false);
  const [suggestedOnly, setSuggestedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (untranslatedOnly) params.set("untranslatedOnly", "1");
      if (suggestedOnly) params.set("suggestedOnly", "1");
      params.set("limit", "200");
      const res = await fetch(`/api/admin/external-sites/trendyol-categories?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در دریافت لیست");
        return;
      }
      setRows(data.results ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }, [query, untranslatedOnly, suggestedOnly]);

  // جست‌وجو با وقفه‌ی کوتاه (debounce)
  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleSync(url: string) {
    setSyncing(true);
    setSyncMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/external-sites/trendyol-categories/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در به‌روزرسانی");
        return;
      }
      setSyncMessage(
        `از ${data.total} دسته‌بندی: ${data.inserted} مورد جدید اضافه شد (${data.autoSuggested} تاش با ترجمه‌ی پیشنهادی خودکار)، ${data.updated} مورد به‌روز شد.`
      );
      await load();
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setSyncing(false);
    }
  }

  function updateLocalNameFa(id: string, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, nameFa: value } : r)));
  }

  async function saveTranslation(row: CacheRow) {
    try {
      const res = await fetch(`/api/admin/external-sites/trendyol-categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameFa: row.nameFa }),
      });
      const data = await res.json();
      // این ترجمه ممکنه روی چندتا ردیف دیگه هم (همون دسته‌ی واقعی، مسیر یا
      // املای متفاوت) اعمال شده باشه -- برای همین کل لیست رو دوباره می‌گیریم،
      // نه فقط همین یه ردیف رو محلی آپدیت می‌کنیم
      if (typeof data?.updatedCount === "number" && data.updatedCount > 1) {
        await load();
      } else {
        // ادیت دستی یعنی تأیید شده -- دیگه «پیشنهادی» نیست
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, nameFaSuggested: false } : r)));
      }
    } catch {
      setError("ذخیره‌ی ترجمه ناموفق بود");
    }
  }

  // آپلود فایلی که قبلاً export شده و کلود (یا هرکسی) ترجمه‌هاش رو پر کرده --
  // شکل مورد انتظار: آرایه‌ای از {path, nameFa} (فیلدهای اضافه مثل param
  // مشکلی ایجاد نمی‌کنن، فقط نادیده گرفته می‌شن)
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage("");
    setError("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const translations = (Array.isArray(parsed) ? parsed : [])
        .filter((item) => item && typeof item.path === "string" && typeof item.nameFa === "string" && item.nameFa.trim())
        .map((item) => ({ path: item.path, nameFa: item.nameFa.trim() }));

      if (translations.length === 0) {
        setError("فایل خالیه یا فرمتش درست نیست (باید آرایه‌ای از {path, nameFa} باشه)");
        return;
      }

      const res = await fetch("/api/admin/external-sites/trendyol-categories/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translations }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در ایمپورت");
        return;
      }
      setImportMessage(`${data.updated} ترجمه با موفقیت وارد شد${data.notFound > 0 ? ` (${data.notFound} موردش پیدا نشد)` : ""}.`);
      await load();
    } catch {
      setError("خطا در خوندن یا پارس فایل");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">ترجمه‌ی دسته‌بندی‌های ترندیول</h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            یه آدرس از ترندیول بده و «استخراج از این آدرس» رو بزن -- فقط موارد جدید اضافه
            می‌شن، ترجمه‌های قبلی دست‌نخورده می‌مونن. میلا این بخش رو ندارد -- سایت میلا
            فروشگاه تک‌برنده و اصلاً منوی دسته‌بندیِ درختی مثل ترندیول نداره (فقط با فیلتر
            برند/جنسیت کار می‌کنه، که توی «فیلترهای ترندیول» برایش sync می‌شه).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* هدف این لینک فقط دانلود JSON از یه اندپوینت API است؛ <a> درست است چون
              لیست ناوبری داخلی نیست و Link معنای دانلود ندارد */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- دانلود از API */}
          <a
            href="/api/admin/external-sites/trendyol-categories/export"
            className="border cut-line rounded-lg px-3 py-2 text-sm hover:border-[var(--color-wine)]"
          >
            ⬇️ دانلود ترجمه‌نشده‌ها
          </a>
          <label className="border cut-line rounded-lg px-3 py-2 text-sm hover:border-[var(--color-wine)] cursor-pointer">
            {importing ? "در حال ایمپورت..." : "⬆️ آپلود ترجمه"}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* آدرس دلخواه (اجباری) -- دیگه هیچ آدرس پیش‌فرض ثابتی نداریم؛ خودت هر
          آدرسی از ترندیول (یا بعداً ترندیول‌میلا) بدی از همون‌جا استخراج
          می‌کنیم. نتایج جدید اضافه می‌شن، جایگزین بقیه نمی‌شن */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="https://www.trendyol.com/erkek-giyim-x-g2-c82"
          dir="ltr"
          className="border cut-line rounded-lg px-3 py-2 text-sm flex-1"
        />
        <button
          onClick={() => {
            if (!customUrl.trim()) return;
            handleSync(customUrl.trim());
          }}
          disabled={syncing || !customUrl.trim()}
          className="bg-[var(--color-wine)] text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60 shrink-0"
        >
          {syncing ? "در حال به‌روزرسانی..." : "🔄 استخراج از این آدرس"}
        </button>
      </div>

      {importMessage && (
        <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2">
          {importMessage}
        </p>
      )}

      {syncMessage && (
        <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2">
          {syncMessage}
        </p>
      )}
      {error && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو (فارسی، ترکی، یا آیدی)..."
          className="border cut-line rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <label className="flex items-center gap-1.5 text-xs cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={untranslatedOnly}
            onChange={(e) => setUntranslatedOnly(e.target.checked)}
          />
          فقط ترجمه‌نشده‌ها
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={suggestedOnly}
            onChange={(e) => setSuggestedOnly(e.target.checked)}
          />
          فقط پیشنهادی (تأییدنشده)
        </label>
        <span className="text-xs text-[var(--color-muted)] shrink-0">
          {total.toLocaleString("fa-IR")} مورد {rows.length < total && `(${rows.length} تای اول نشون داده می‌شه)`}
        </span>
      </div>

      <div className="border cut-line rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_90px] gap-2 bg-[var(--color-linen-dim)] px-3 py-2 text-xs font-bold">
          <span>مسیر ترکی</span>
          <span>ترجمه‌ی فارسی</span>
          <span>پارامتر wc=</span>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--color-muted)] px-3 py-4">در حال بارگذاری...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] px-3 py-4">
            چیزی پیدا نشد. اگه هنوز هیچی sync نکردی، یه آدرس بده و «استخراج از این آدرس» رو بزن.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_1fr_90px] gap-2 items-center px-3 py-1.5 border-t cut-line text-sm"
            >
              <span className="text-xs text-[var(--color-muted)] truncate" title={row.path}>
                {row.path}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={row.nameFa ?? ""}
                  onChange={(e) => updateLocalNameFa(row.id, e.target.value)}
                  onBlur={() => saveTranslation(row)}
                  placeholder="ترجمه فارسی..."
                  className={`border cut-line rounded-lg px-2 py-1 text-sm flex-1 ${
                    !row.nameFa ? "border-amber-400" : row.nameFaSuggested ? "border-dashed border-amber-400" : ""
                  }`}
                />
                {row.nameFaSuggested && (
                  <span
                    title="این ترجمه پیشنهادیه (خودکار یا import)، هنوز دستی تأیید نشده"
                    className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 shrink-0"
                  >
                    پیشنهادی
                  </span>
                )}
              </div>
              <span className="text-xs font-mono text-[var(--color-muted)]" dir="ltr">
                {row.param}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";

type LogRow = {
  id: string;
  url: string;
  error: string;
  source: string;
  siteSlug: string | null;
  createdAt: string;
};

const SOURCE_LABELS: Record<string, string> = {
  "check-url": "بررسی فیلتر (قبل از اعمال)",
  "page-load": "لود اولیه‌ی صفحه",
  "load-more": "بارگذاری بیشتر",
};

export default function TrendyolFetchLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/trendyol-fetch-logs?limit=100");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در دریافت لاگ‌ها");
        return;
      }
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyUrl(row: LogRow) {
    await navigator.clipboard.writeText(row.url);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(""), 1500);
  }

  async function deleteRow(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/admin/trendyol-fetch-logs/${id}`, { method: "DELETE" });
  }

  async function clearAll() {
    if (!confirm("همه‌ی لاگ‌ها پاک بشن؟")) return;
    await fetch("/api/admin/trendyol-fetch-logs", { method: "DELETE" });
    await load();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">لاگ خطاهای ترندیول</h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            هر URLای که با ترندیول به خطا خورده (و به کاربر پیام «بعداً دوباره تلاش کنید» نشون داده
            شده) این‌جا با جزئیات کامل ثبت می‌شه تا بشه بعداً همون شرایط رو شبیه‌سازی کرد.
          </p>
        </div>
        <button
          onClick={clearAll}
          className="text-xs border cut-line rounded-lg px-3 py-2 hover:border-red-400 hover:text-red-600 shrink-0"
        >
          پاک کردن همه
        </button>
      </div>

      {error && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">{error}</p>}

      <p className="text-xs text-[var(--color-muted)]">
        {total.toLocaleString("fa-IR")} مورد {logs.length < total && `(${logs.length} تای اخیر نشون داده می‌شه)`}
      </p>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">هنوز هیچ خطایی ثبت نشده.</p>
        ) : (
          logs.map((row) => (
            <div key={row.id} className="border cut-line rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold bg-[var(--color-linen-dim)] rounded-full px-2 py-0.5">
                    {SOURCE_LABELS[row.source] ?? row.source}
                  </span>
                  {row.siteSlug && (
                    <span className="text-[10px] text-[var(--color-muted)]">سایت: {row.siteSlug}</span>
                  )}
                  <span className="text-[10px] text-[var(--color-muted)]" dir="ltr">
                    {new Date(row.createdAt).toLocaleString("fa-IR")}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyUrl(row)}
                    className="text-xs border cut-line rounded-lg px-2 py-1 hover:border-[var(--color-wine)]"
                  >
                    {copiedId === row.id ? "کپی شد ✓" : "کپی آدرس"}
                  </button>
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    حذف
                  </button>
                </div>
              </div>
              <p className="text-xs font-mono break-all text-[var(--color-ink)]" dir="ltr">
                {row.url}
              </p>
              <p className="text-xs text-red-700 whitespace-pre-wrap">{row.error}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

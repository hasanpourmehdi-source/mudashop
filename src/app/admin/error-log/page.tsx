"use client";

import { useCallback, useEffect, useState } from "react";

type LogRow = {
  id: string;
  message: string;
  stack: string | null;
  context: string | null;
  source: "SERVER" | "CLIENT";
  resolvedAt: string | null;
  createdAt: string;
};

// لاگِ خودکارِ خطاهای سرور/کلاینت (نسخه‌ی خودمیزبانِ ساده‌ی Sentry) -- از
// instrumentation.ts (سرور) و global-error.tsx (کلاینت) پر می‌شه
export default function AdminErrorLogPage() {
  const [data, setData] = useState<{ logs: LogRow[]; unresolvedCount: number } | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/error-log?resolved=${showResolved}`);
    if (res.ok) setData(await res.json());
  }, [showResolved]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleResolved(id: string) {
    await fetch(`/api/admin/error-log/${id}`, { method: "PATCH" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">لاگ خطاهای سایت</h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {data ? `${data.unresolvedCount} خطای بررسی‌نشده` : "..."}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-[var(--color-wine)]"
          />
          نمایش بررسی‌شده‌ها هم
        </label>
      </div>

      {!data ? (
        <p className="text-xs text-[var(--color-muted)]">در حال بارگذاری...</p>
      ) : data.logs.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">
          {showResolved ? "هیچ خطایی ثبت نشده." : "خطای بررسی‌نشده‌ای نیست 🎉"}
        </p>
      ) : (
        <div className="space-y-2">
          {data.logs.map((log) => (
            <div key={log.id} className="border cut-line rounded-lg bg-white text-sm overflow-hidden">
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.source === "SERVER" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {log.source === "SERVER" ? "سرور" : "مرورگر"}
                    </span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {new Date(log.createdAt).toLocaleString("fa-IR")}
                    </span>
                    {log.resolvedAt && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        بررسی‌شده
                      </span>
                    )}
                  </div>
                  <p className="font-medium break-words">{log.message}</p>
                  {log.context && (
                    <p className="text-[11px] text-[var(--color-muted)] mt-0.5 break-words">{log.context}</p>
                  )}
                  {log.stack && (
                    <button
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      className="text-[11px] text-[var(--color-wine)] hover:underline mt-1"
                    >
                      {expandedId === log.id ? "بستن جزئیات" : "نمایش stack trace"}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => toggleResolved(log.id)}
                  className="shrink-0 text-xs px-3 py-1 rounded-full font-medium bg-[var(--color-linen-dim)] hover:bg-green-100"
                >
                  {log.resolvedAt ? "بازگردانی" : "بررسی شد"}
                </button>
              </div>
              {expandedId === log.id && log.stack && (
                <pre className="bg-[var(--color-linen-dim)] text-[10px] p-3 overflow-x-auto whitespace-pre-wrap break-words border-t cut-line">
                  {log.stack}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

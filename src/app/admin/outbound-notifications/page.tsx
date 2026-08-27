"use client";

import { useCallback, useEffect, useState } from "react";
import { NOTIFICATION_EVENT_LABELS } from "@/lib/outboundEvents";

type LogRow = {
  id: string;
  channel: string;
  eventType: string;
  to: string;
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
};

const STATUS_BADGE: Record<string, string> = {
  SENT: "bg-green-100 text-green-800",
  LOGGED: "bg-[var(--color-linen-dim)] text-[var(--color-muted)]",
  FAILED: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  SENT: "ارسال شد",
  LOGGED: "فقط ثبت (بدون پراوایدر)",
  FAILED: "خطا",
};

// لاگ اعلان‌های خروجی (ایمیل/پیامک) -- جدیدترین اول، با فیلتر وضعیت.
export default function OutboundNotificationsPage() {
  const [data, setData] = useState<{ logs: LogRow[]; counts: Record<string, number> } | null>(null);
  const [status, setStatus] = useState<string>("");

  const load = useCallback(async () => {
    const qs = status ? `?status=${status}` : "";
    const res = await fetch(`/api/admin/outbound-notifications${qs}`);
    if (res.ok) setData(await res.json());
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">لاگ ایمیل/پیامک (اعلان خارج از سایت)</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border cut-line rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">همه</option>
          <option value="SENT">ارسال شده</option>
          <option value="LOGGED">ثبت‌شده (بدون پراوایدر)</option>
          <option value="FAILED">خطا</option>
        </select>
      </div>

      {data?.counts && (
        <p className="text-xs text-[var(--color-muted)]">
          کل: {Object.entries(data.counts).map(([k, v]) => `${STATUS_LABEL[k] ?? k}: ${v}`).join(" | ")}
        </p>
      )}

      {!data ? (
        <p className="text-xs text-[var(--color-muted)]">در حال بارگذاری...</p>
      ) : data.logs.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">اعلان خروجی‌ای ثبت نشده است.</p>
      ) : (
        <div className="border cut-line rounded-xl bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right border-b cut-line text-[11px] text-[var(--color-muted)]">
                <th className="px-3 py-2">زمان</th>
                <th className="px-3 py-2">کاربر</th>
                <th className="px-3 py-2">کانال</th>
                <th className="px-3 py-2">رویداد</th>
                <th className="px-3 py-2">مقصد</th>
                <th className="px-3 py-2">متن</th>
                <th className="px-3 py-2">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.id} className="border-b cut-line align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-[11px] text-[var(--color-muted)]">
                    {new Date(log.createdAt).toLocaleString("fa-IR")}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {log.user?.name || log.user?.email || log.to}
                  </td>
                  <td className="px-3 py-2">{log.channel === "EMAIL" ? "ایمیل" : "پیامک"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {NOTIFICATION_EVENT_LABELS[log.eventType as keyof typeof NOTIFICATION_EVENT_LABELS] ?? log.eventType}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[11px]">{log.to}</td>
                  <td className="px-3 py-2 text-[12px] max-w-[260px]">{log.body}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE[log.status] ?? ""}`}>
                      {STATUS_LABEL[log.status] ?? log.status}
                    </span>
                    {log.error && (
                      <p className="text-[10px] text-red-600 mt-1 max-w-[180px] break-words">{log.error}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
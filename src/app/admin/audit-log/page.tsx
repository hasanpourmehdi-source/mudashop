"use client";

import { useEffect, useState } from "react";

type LogRow = {
  id: string;
  adminName: string;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  STAFF_CREATED: "ساختن حساب کارمند",
  STAFF_SCOPES_UPDATED: "تغییر دسترسی کارمند",
  STAFF_REMOVED: "لغو دسترسی کارمند",
  PAYMENT_APPROVED: "تأیید فیش پرداخت",
  PAYMENT_REJECTED: "رد فیش پرداخت",
  WALLET_WITHDRAWAL_APPROVED: "تأیید برداشت کیف پول",
  WALLET_WITHDRAWAL_REJECTED: "رد برداشت کیف پول",
  SETTINGS_UPDATED: "تغییر تنظیمات سایت",
  ACCOUNT_UNLOCKED: "باز کردن قفل حساب",
};

// لاگِ اقدام‌های حساسِ ادمین/کارمند -- برخلاف تاریخچه‌ی سفارش (که فقط چی/کِی
// رو نشون می‌ده)، اینجا مشخص می‌کند کدوم حساب این اقدام رو انجام داده.
export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/audit-log")
      .then((res) => (res.ok ? res.json() : { logs: [] }))
      .then((data) => setLogs(data.logs));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">لاگِ فعالیتِ ادمین/کارمندان</h1>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          فقط اقدام‌های حساس (تأیید پرداخت، برداشت کیف پول، تغییرِ دسترسیِ کارمندان و...) ثبت می‌شود، نه هر کلیک.
        </p>
      </div>

      {!logs ? (
        <p className="text-xs text-[var(--color-muted)]">در حال بارگذاری...</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">هنوز اقدامی ثبت نشده است.</p>
      ) : (
        <div className="border cut-line rounded-xl bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right border-b cut-line text-[11px] text-[var(--color-muted)]">
                <th className="px-3 py-2">زمان</th>
                <th className="px-3 py-2">انجام‌دهنده</th>
                <th className="px-3 py-2">اقدام</th>
                <th className="px-3 py-2">هدف</th>
                <th className="px-3 py-2">جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b cut-line align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-[11px] text-[var(--color-muted)]">
                    {new Date(log.createdAt).toLocaleString("fa-IR")}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {log.adminName} <span className="text-[11px] text-[var(--color-muted)]">({log.adminEmail})</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[11px]">
                    {log.targetType ? `${log.targetType}${log.targetId ? ` #${log.targetId.slice(-8)}` : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-[12px] max-w-[320px]">{log.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

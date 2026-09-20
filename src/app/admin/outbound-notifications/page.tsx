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

const EMAIL_PROVIDER = "emailProvider";
const EMAIL_API_KEY = "emailProviderApiKey";
const EMAIL_FROM_ADDRESS = "emailProviderFromAddress";
const SMTP_HOST = "smtpHost";
const SMTP_PORT = "smtpPort";
const SMTP_SECURE = "smtpSecure";
const SMTP_USER = "smtpUser";
const SMTP_PASSWORD = "smtpPassword";

// لاگ اعلان‌های خروجی (ایمیل/پیامک) -- جدیدترین اول، با فیلتر وضعیت.
export default function OutboundNotificationsPage() {
  const [data, setData] = useState<{ logs: LogRow[]; counts: Record<string, number> } | null>(null);
  const [status, setStatus] = useState<string>("");

  const [provider, setProvider] = useState<"resend" | "smtp">("resend");
  const [apiKey, setApiKey] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Record<string, string>) => {
        setProvider(data[EMAIL_PROVIDER] === "smtp" ? "smtp" : "resend");
        setApiKey(data[EMAIL_API_KEY] ?? "");
        setFromAddress(data[EMAIL_FROM_ADDRESS] ?? "");
        setSmtpHost(data[SMTP_HOST] ?? "");
        setSmtpPort(data[SMTP_PORT] ?? "587");
        setSmtpSecure(data[SMTP_SECURE] === "true");
        setSmtpUser(data[SMTP_USER] ?? "");
        setSmtpPassword(data[SMTP_PASSWORD] ?? "");
      })
      .finally(() => setLoadingSettings(false));
  }, []);

  async function handleSaveEmailSettings() {
    setSettingsError("");
    setSettingsSuccess(false);
    setSavingSettings(true);
    try {
      for (const [key, value] of [
        [EMAIL_PROVIDER, provider],
        [EMAIL_API_KEY, apiKey],
        [EMAIL_FROM_ADDRESS, fromAddress],
        [SMTP_HOST, smtpHost],
        [SMTP_PORT, smtpPort],
        [SMTP_SECURE, smtpSecure ? "true" : "false"],
        [SMTP_USER, smtpUser],
        [SMTP_PASSWORD, smtpPassword],
      ] as const) {
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "خطا در ذخیره");
        }
      }
      setSettingsSuccess(true);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSendTest() {
    setTestResult(null);
    setTesting(true);
    try {
      const res = await fetch("/api/admin/email-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ status: "FAILED", error: data.error ?? "خطا" });
      } else {
        setTestResult(data);
      }
    } catch {
      setTestResult({ status: "FAILED", error: "خطای شبکه" });
    } finally {
      setTesting(false);
    }
  }

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
      <div className="border cut-line rounded-xl p-4 bg-white space-y-3">
        <div>
          <p className="text-sm font-bold">پرووایدرِ ارسالِ ایمیل</p>
          <p className="text-[10px] text-[var(--color-muted)] mt-1">
            یا از Resend (سرویسِ API-محورِ آماده) استفاده کن، یا از جیمیلِ خودت (یا هر سرورِ SMTPِ دیگه) وصل شو.
          </p>
        </div>
        {loadingSettings ? (
          <p className="text-xs text-[var(--color-muted)]">در حال بارگذاری...</p>
        ) : (
          <>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setProvider("resend")}
                className={`flex-1 border cut-line rounded-lg px-3 py-2 text-sm font-medium ${
                  provider === "resend" ? "bg-[var(--color-ochre)]" : "bg-white"
                }`}
              >
                Resend
              </button>
              <button
                type="button"
                onClick={() => setProvider("smtp")}
                className={`flex-1 border cut-line rounded-lg px-3 py-2 text-sm font-medium ${
                  provider === "smtp" ? "bg-[var(--color-ochre)]" : "bg-white"
                }`}
              >
                جیمیل / SMTP
              </button>
            </div>

            {provider === "resend" ? (
              <>
                <p className="text-[10px] text-[var(--color-muted)]">
                  اگه کلیدِ API اینجا خالی بمونه، سایت از env varِ RESEND_API_KEY (اگه تنظیم شده باشه) استفاده می‌کنه.
                </p>
                <div>
                  <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">کلیدِ API</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="re_xxxxxxxx"
                    dir="ltr"
                    className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">
                  برای جیمیل: هاست <span dir="ltr">smtp.gmail.com</span>، پورتِ ۵۸۷ (بدونِ تیکِ «اتصالِ امن»). به‌جای
                  رمزِ عبورِ همیشگیِ اکانتت، باید یه «رمزِ اپلیکیشن» (App Password) بسازی -- توی تنظیماتِ امنیتیِ
                  گوگل، بعد از روشن‌کردنِ ورودِ دومرحله‌ای، از بخشِ App Passwords یه رمزِ ۱۶کاراکتریِ مخصوص بساز و
                  همون رو اینجا بذار (رمزِ خودت کار نمی‌کنه، گوگل ردش می‌کنه).
                </p>
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <div>
                    <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">هاستِ SMTP</label>
                    <input
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      dir="ltr"
                      className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">پورت</label>
                    <input
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                      dir="ltr"
                      className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">ایمیلِ اکانت (یوزر)</label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="you@gmail.com"
                    dir="ltr"
                    className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">رمزِ اپلیکیشن (App Password)</label>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    dir="ltr"
                    className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                  />
                  اتصالِ امن (SSL/TLS) -- فقط برای پورتِ ۴۶۵ روشنش کن
                </label>
              </>
            )}

            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">آدرسِ فرستنده</label>
              <input
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="مداشاپ <noreply@mudashop.ir>"
                dir="ltr"
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
            {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
            {settingsSuccess && <p className="text-xs text-green-700">ذخیره شد.</p>}
            <button
              onClick={handleSaveEmailSettings}
              disabled={savingSettings}
              className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {savingSettings ? "در حال ذخیره..." : "ذخیره"}
            </button>

            <div className="pt-3 border-t cut-line space-y-2">
              <p className="text-sm font-bold">ارسال ایمیل تستی</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="ایمیلِ گیرنده..."
                  dir="ltr"
                  className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm bg-white"
                />
                <button
                  onClick={handleSendTest}
                  disabled={testing || !testEmail}
                  className="border cut-line px-4 py-2 rounded-full text-sm font-medium bg-white disabled:opacity-50 shrink-0"
                >
                  {testing ? "..." : "ارسال تستی"}
                </button>
              </div>
              {testResult && (
                <p className={`text-xs ${testResult.status === "FAILED" ? "text-red-600" : "text-green-700"}`}>
                  {STATUS_LABEL[testResult.status] ?? testResult.status}
                  {testResult.error && ` -- ${testResult.error}`}
                </p>
              )}
            </div>
          </>
        )}
      </div>

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
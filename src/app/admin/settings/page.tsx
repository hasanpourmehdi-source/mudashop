"use client";

import { useEffect, useState } from "react";

const RETURN_POLICY_KEY = "returnPolicyText";

// جفت‌های کلید هشدار/نیمه‌هشدار برای هر مرحله‌ی «منتظر اقدام» -- عیناً همون
// کلیدهایی که src/lib/siteSettings.ts و src/lib/orderAlerts.ts استفاده می‌کنن
const ALERT_STAGES: { title: string; warnKey: string; alertKey: string }[] = [
  {
    title: "سفارش جدید -- هنوز باز نشده",
    warnKey: "alertFirstReviewWarnHours",
    alertKey: "alertFirstReviewAlertHours",
  },
  {
    title: "منتظر بررسی فیش پرداخت اقلام",
    warnKey: "alertItemPaymentReviewWarnHours",
    alertKey: "alertItemPaymentReviewAlertHours",
  },
  {
    title: "منتظر بررسی فیش هزینه ارسال/باربری",
    warnKey: "alertShippingPaymentReviewWarnHours",
    alertKey: "alertShippingPaymentReviewAlertHours",
  },
  {
    title: "در صف خرید (منتظر خرید از ترندیول)",
    warnKey: "alertAwaitingPurchaseWarnHours",
    alertKey: "alertAwaitingPurchaseAlertHours",
  },
  {
    title: "منتظر بررسی پاسخ مشتری به تغییر اقلام",
    warnKey: "alertAdminItemsReviewWarnHours",
    alertKey: "alertAdminItemsReviewAlertHours",
  },
  {
    title: "ارسال شده ولی مدتی از ارسالش گذشته",
    warnKey: "alertShippedTooLongWarnHours",
    alertKey: "alertShippedTooLongAlertHours",
  },
  {
    title: "درخواست مرجوعی -- منتظر بررسی ادمین",
    warnKey: "alertReturnReviewWarnHours",
    alertKey: "alertReturnReviewAlertHours",
  },
];
const REASSURANCE_KEY = "reassurancePingAfterHours";

export default function AdminSettingsPage() {
  const [returnPolicy, setReturnPolicy] = useState("");
  const [thresholds, setThresholds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [thresholdsSuccess, setThresholdsSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : Promise.resolve({} as Record<string, string>)))
      .then((data: Record<string, string>) => {
        setReturnPolicy(data[RETURN_POLICY_KEY] ?? "");
        setThresholds(data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveKey(key: string, value: string) {
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `خطا در ذخیره (کد ${res.status})`);
    }
  }

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      await saveKey(RETURN_POLICY_KEY, returnPolicy);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveThresholds() {
    setError("");
    setThresholdsSuccess(false);
    setSavingThresholds(true);
    try {
      const keys = [...ALERT_STAGES.flatMap((s) => [s.warnKey, s.alertKey]), REASSURANCE_KEY];
      for (const key of keys) {
        await saveKey(key, thresholds[key] ?? "");
      }
      setThresholdsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingThresholds(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">تنظیمات</h1>

      <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <p className="text-sm font-bold">متن‌های سایت</p>
        <div>
          <p className="text-sm font-bold mb-1">شرایط مرجوع کردن کالا</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            همین متن دقیقاً زیر دکمه‌ی «افزودن به سبد» توی صفحه‌ی هر محصول مزون نشون داده می‌شه.
          </p>
          <textarea
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
            rows={4}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">ذخیره شد.</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
        </button>
      </div>

      <div className="border cut-line rounded-lg p-4 bg-white space-y-4">
        <div>
          <p className="text-sm font-bold">آستانه‌های هشدار سفارش‌های گیرکرده</p>
          <p className="text-[10px] text-[var(--color-muted)] mt-1">
            وقتی سفارشی بیشتر از «نیمه‌هشدار» ساعت توی یه مرحله بدون تغییر بمونه، توی داشبورد زرد نشون
            داده می‌شه؛ بعد از «هشدار» ساعت، قرمز.
          </p>
        </div>

        {ALERT_STAGES.map((stage) => (
          <div key={stage.warnKey} className="grid grid-cols-[1fr_100px_100px] gap-2 items-end">
            <p className="text-xs text-[var(--color-muted)]">{stage.title}</p>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">نیمه‌هشدار (ساعت)</label>
              <input
                type="number"
                min={0}
                value={thresholds[stage.warnKey] ?? ""}
                onChange={(e) => setThresholds((prev) => ({ ...prev, [stage.warnKey]: e.target.value }))}
                className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">هشدار (ساعت)</label>
              <input
                type="number"
                min={0}
                value={thresholds[stage.alertKey] ?? ""}
                onChange={(e) => setThresholds((prev) => ({ ...prev, [stage.alertKey]: e.target.value }))}
                className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
              />
            </div>
          </div>
        ))}

        <div className="grid grid-cols-[1fr_100px_100px] gap-2 items-end border-t cut-line pt-3">
          <p className="text-xs text-[var(--color-muted)]">
            یادآوری خودکار «حواسمون به سفارشت هست» به مشتری بعد از بی‌حرکتی
          </p>
          <div>
            <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">ساعت</label>
            <input
              type="number"
              min={0}
              value={thresholds[REASSURANCE_KEY] ?? ""}
              onChange={(e) => setThresholds((prev) => ({ ...prev, [REASSURANCE_KEY]: e.target.value }))}
              className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
            />
          </div>
          <div />
        </div>

        {thresholdsSuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}

        <button
          onClick={handleSaveThresholds}
          disabled={savingThresholds}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingThresholds ? "در حال ذخیره..." : "ذخیره آستانه‌ها"}
        </button>
      </div>
    </div>
  );
}

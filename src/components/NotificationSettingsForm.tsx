"use client";

import { useCallback, useEffect, useState } from "react";

type NotificationEventsPayload = { key: string; label: string };

type Settings = {
  emailOn: boolean;
  smsOn: boolean;
  pushOn: boolean;
  emailDisabledEvents: string[];
  smsDisabledEvents: string[];
  pushDisabledEvents: string[];
  hasPhone: boolean;
  hasPushSubscription: boolean;
  email: string | null;
  events: NotificationEventsPayload[];
};

// رشته‌ی base64url که سرور برمی‌گردونه رو به Uint8Array تبدیل می‌کند -- فرمتی
// که pushManager.subscribe برای applicationServerKey نیاز دارد
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// مدیریت ترجیحات اعلان خارج از سایت (ایمیل/پیامک/پوش) -- لود از
// /api/settings/notifications و ذخیره با PUT در همان API. پوش برخلاف
// ایمیل/پیامک یه سوییچ ساده نیست -- روشن‌کردنش نیاز به اجازه‌ی مرورگر و
// ساختن subscription واقعی دارد، پس مسیر جدای خودش (/api/push/subscribe و
// /api/push/unsubscribe) را دارد؛ فقط رویدادهای فعال/غیرفعالش با همون PUT
// عمومی ذخیره می‌شود.
export function NotificationSettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pushSupported, setPushSupported] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/notifications");
      if (!res.ok) throw new Error();
      setSettings(await res.json());
    } catch {
      setError("بارگذاری تنظیمات ناموفق بود");
    }
  }, []);

  useEffect(() => {
    load();
    setPushSupported(
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
    );
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailOn: settings.emailOn,
          smsOn: settings.smsOn,
          emailDisabledEvents: settings.emailDisabledEvents,
          smsDisabledEvents: settings.smsDisabledEvents,
          pushDisabledEvents: settings.pushDisabledEvents,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError("ذخیره تنظیمات ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  // فعال‌کردن پوش: اجازه‌ی مرورگر + ساختن subscription واقعی + ثبتش روی سرور.
  // هر خطا (رد کردن اجازه، عدم پیکربندی VAPID روی سرور، ...) پیغام مشخص می‌دهد
  async function enablePush() {
    if (!settings) return;
    setPushBusy(true);
    setPushError(null);
    try {
      const keyRes = await fetch("/api/push/public-key");
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        setPushError("این قابلیت هنوز روی سرور پیکربندی نشده است.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushError("اجازه‌ی نمایش اعلان داده نشد.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error();

      setSettings({ ...settings, pushOn: true, hasPushSubscription: true });
    } catch {
      setPushError("فعال‌سازی پوش ناموفق بود.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    if (!settings) return;
    setPushBusy(true);
    setPushError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSettings({ ...settings, pushOn: false });
    } catch {
      setPushError("خاموش‌کردن پوش ناموفق بود.");
    } finally {
      setPushBusy(false);
    }
  }

  if (error && !settings) {
    return <p className="text-xs text-red-600">{error}</p>;
  }
  if (!settings) return <p className="text-xs text-[var(--color-muted)]">در حال بارگذاری...</p>;

  const toggleEvent = (channel: "email" | "sms" | "push", key: string) => {
    const field =
      channel === "email" ? "emailDisabledEvents" : channel === "sms" ? "smsDisabledEvents" : "pushDisabledEvents";
    const list = settings[field];
    setSettings({
      ...settings,
      [field]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key],
    });
  };

  const ChannelToggles = ({
    channel,
    on,
    disabledList,
  }: {
    channel: "email" | "sms" | "push";
    on: boolean;
    disabledList: string[];
  }) => (
    <div className="space-y-1.5">
      {settings.events.map((ev) => {
        const active = on && !disabledList.includes(ev.key);
        return (
          <label key={ev.key} className="flex items-center justify-between text-sm">
            <span>{ev.label}</span>
            <input
              type="checkbox"
              checked={active}
              onChange={() => toggleEvent(channel, ev.key)}
              className="accent-[var(--color-wine)]"
            />
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="border cut-line rounded-lg p-5 bg-white space-y-4 text-sm">
      <div>
        <h2 className="font-bold mb-1">اعلان‌های ایمیل/پیامک/پوش</h2>
        <p className="text-[11px] text-[var(--color-muted)]">
          رویدادهای سفارش و حساب علاوه بر زنگوله‌ی داخل سایت، از این کانال‌ها هم برایتان ارسال شود.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="flex items-center justify-between mb-2 font-medium">
            <span>ایمیل ({settings.email ?? "—"})</span>
            <input
              type="checkbox"
              checked={settings.emailOn}
              onChange={() => setSettings({ ...settings, emailOn: !settings.emailOn })}
              className="accent-[var(--color-wine)]"
            />
          </label>
          {settings.emailOn && <ChannelToggles channel="email" on={settings.emailOn} disabledList={settings.emailDisabledEvents} />}
        </div>

        <div>
          <label className="flex items-center justify-between mb-2 font-medium">
            <span>پیامک</span>
            <input
              type="checkbox"
              checked={settings.smsOn}
              disabled={!settings.hasPhone}
              onChange={() => setSettings({ ...settings, smsOn: !settings.smsOn })}
              className="accent-[var(--color-wine)]"
            />
          </label>
          {!settings.hasPhone && (
            <p className="text-[11px] text-[var(--color-muted)] mb-2">
              برای دریافت پیامک ابتدا شماره موبایل را در فرم «مشخصات» بالا ثبت کنید.
            </p>
          )}
          {settings.smsOn && <ChannelToggles channel="sms" on={settings.smsOn} disabledList={settings.smsDisabledEvents} />}
        </div>

        <div>
          <label className="flex items-center justify-between mb-2 font-medium">
            <span>پوش (مرورگر)</span>
            {pushSupported ? (
              <input
                type="checkbox"
                checked={settings.pushOn}
                disabled={pushBusy}
                onChange={() => (settings.pushOn ? disablePush() : enablePush())}
                className="accent-[var(--color-wine)]"
              />
            ) : null}
          </label>
          {!pushSupported && (
            <p className="text-[11px] text-[var(--color-muted)] mb-2">
              مرورگر فعلی از اعلان پوش پشتیبانی نمی‌کند.
            </p>
          )}
          {pushBusy && <p className="text-[11px] text-[var(--color-muted)] mb-2">در حال انجام...</p>}
          {pushError && <p className="text-[11px] text-red-600 mb-2">{pushError}</p>}
          {settings.pushOn && <ChannelToggles channel="push" on={settings.pushOn} disabledList={settings.pushDisabledEvents} />}
        </div>
      </div>

      {saved && <p className="text-xs text-green-700">تنظیمات ذخیره شد.</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-60"
      >
        {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
      </button>
    </div>
  );
}

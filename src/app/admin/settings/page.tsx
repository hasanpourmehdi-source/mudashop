"use client";

import { useEffect, useState } from "react";

const RETURN_POLICY_KEY = "returnPolicyText";
const POSTER_CURRENCY_KEY = "posterCurrencyText";
const ABOUT_KEY = "aboutText";
const TERMS_KEY = "termsText";
const PRIVACY_KEY = "privacyText";
const FAQ_KEY = "faqText";

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
const LOW_STOCK_ENABLED_KEY = "lowStockAlertEnabled";
const LOW_STOCK_THRESHOLD_KEY = "lowStockAlertThreshold";
const CASH_ON_DELIVERY_KEY = "cashOnDeliveryEnabled";
const NON_RETURNABLE_ENABLED_KEY = "nonReturnableProductsEnabled";

const TRUST_BADGES: { n: number; icon: string; enabledKey: string; textKey: string }[] = [
  { n: 1, icon: "🛡️", enabledKey: "trustBadge1Enabled", textKey: "trustBadge1Text" },
  { n: 2, icon: "🚚", enabledKey: "trustBadge2Enabled", textKey: "trustBadge2Text" },
  { n: 3, icon: "↩️", enabledKey: "trustBadge3Enabled", textKey: "trustBadge3Text" },
  { n: 4, icon: "💰", enabledKey: "trustBadge4Enabled", textKey: "trustBadge4Text" },
];

// کلیدِ هرکدوم توی siteSettings به‌صورتِ "skip..." (یعنی true=این مرحله حذف
// بشه) ذخیره می‌شه، ولی خودِ چک‌باکس رو برعکسش نشون می‌دیم -- چک‌خورده یعنی
// «این مرحله فعاله»، چون این چیزیه که ادمین با نگاه‌کردن سریع می‌فهمه
const STAGE_TOGGLES: { key: string; title: string; whenOff: string }[] = [
  {
    key: "skipAdminReview",
    title: "تأییدِ اولیه‌ی سفارش توسط ادمین (چکِ موجودی)",
    whenOff: "همون لحظه‌ی ثبتِ سفارش، بدونِ بررسیِ دستیِ ادمین، مستقیم برای پرداخت به «کارتِ پیش‌فرض» آماده می‌شه.",
  },
  {
    key: "skipPaymentVerification",
    title: "تأییدِ فیش‌های واریزی",
    whenOff: "به‌محضِ آپلودِ فیش (دورِ اقلام یا دورِ ارسال/باربری)، خودِ سیستم فوری تأییدش می‌کنه -- بدونِ منتظرِ کلیکِ ادمین.",
  },
  {
    key: "skipShippingCalculation",
    title: "محاسبه‌ی هزینه‌ی باربری و ارسال",
    whenOff: "هزینه‌ی ارسال (سفارشِ مزون) و باربری (سفارشِ خارجی) همیشه صفر حساب می‌شه -- چون قبلاً توی قیمتِ کالا لحاظ شده.",
  },
];

export default function AdminSettingsPage() {
  const [returnPolicy, setReturnPolicy] = useState("");
  const [posterCurrencyText, setPosterCurrencyText] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [termsText, setTermsText] = useState("");
  const [privacyText, setPrivacyText] = useState("");
  const [faqText, setFaqText] = useState("");
  const [thresholds, setThresholds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [thresholdsSuccess, setThresholdsSuccess] = useState(false);
  const [stageActive, setStageActive] = useState<Record<string, boolean>>({});
  const [savingStages, setSavingStages] = useState(false);
  const [stagesSuccess, setStagesSuccess] = useState(false);
  const [lowStockEnabled, setLowStockEnabled] = useState(false);
  const [savingLowStock, setSavingLowStock] = useState(false);
  const [lowStockSuccess, setLowStockSuccess] = useState(false);
  const [cashOnDeliveryEnabled, setCashOnDeliveryEnabled] = useState(false);
  const [savingCod, setSavingCod] = useState(false);
  const [codSuccess, setCodSuccess] = useState(false);
  const [nonReturnableEnabled, setNonReturnableEnabled] = useState(false);
  const [savingNonReturnable, setSavingNonReturnable] = useState(false);
  const [nonReturnableSuccess, setNonReturnableSuccess] = useState(false);
  const [badgeEnabled, setBadgeEnabled] = useState<Record<string, boolean>>({});
  const [badgeText, setBadgeText] = useState<Record<string, string>>({});
  const [savingBadges, setSavingBadges] = useState(false);
  const [badgesSuccess, setBadgesSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : Promise.resolve({} as Record<string, string>)))
      .then((data: Record<string, string>) => {
        setReturnPolicy(data[RETURN_POLICY_KEY] ?? "");
        setPosterCurrencyText(data[POSTER_CURRENCY_KEY] ?? "");
        setAboutText(data[ABOUT_KEY] ?? "");
        setTermsText(data[TERMS_KEY] ?? "");
        setPrivacyText(data[PRIVACY_KEY] ?? "");
        setFaqText(data[FAQ_KEY] ?? "");
        setThresholds(data);
        setStageActive(
          Object.fromEntries(STAGE_TOGGLES.map((t) => [t.key, data[t.key] !== "true"]))
        );
        setLowStockEnabled(data[LOW_STOCK_ENABLED_KEY] === "true");
        setCashOnDeliveryEnabled(data[CASH_ON_DELIVERY_KEY] === "true");
        setNonReturnableEnabled(data[NON_RETURNABLE_ENABLED_KEY] === "true");
        setBadgeEnabled(
          Object.fromEntries(TRUST_BADGES.map((b) => [b.enabledKey, data[b.enabledKey] === "true"]))
        );
        setBadgeText(Object.fromEntries(TRUST_BADGES.map((b) => [b.textKey, data[b.textKey] ?? ""])));
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
      await saveKey(POSTER_CURRENCY_KEY, posterCurrencyText);
      await saveKey(ABOUT_KEY, aboutText);
      await saveKey(TERMS_KEY, termsText);
      await saveKey(PRIVACY_KEY, privacyText);
      await saveKey(FAQ_KEY, faqText);
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

  async function handleSaveStages() {
    setError("");
    setStagesSuccess(false);
    setSavingStages(true);
    try {
      for (const toggle of STAGE_TOGGLES) {
        // stageActive چک‌باکسِ خودِ UIه (چک‌خورده=فعال) -- برعکسش (skip) توی
        // siteSettings ذخیره می‌شه
        await saveKey(toggle.key, stageActive[toggle.key] === false ? "true" : "false");
      }
      setStagesSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingStages(false);
    }
  }

  async function handleSaveLowStock() {
    setError("");
    setLowStockSuccess(false);
    setSavingLowStock(true);
    try {
      await saveKey(LOW_STOCK_ENABLED_KEY, lowStockEnabled ? "true" : "false");
      await saveKey(LOW_STOCK_THRESHOLD_KEY, thresholds[LOW_STOCK_THRESHOLD_KEY] || "5");
      setLowStockSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingLowStock(false);
    }
  }

  async function handleSaveCod() {
    setError("");
    setCodSuccess(false);
    setSavingCod(true);
    try {
      await saveKey(CASH_ON_DELIVERY_KEY, cashOnDeliveryEnabled ? "true" : "false");
      setCodSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingCod(false);
    }
  }

  async function handleSaveNonReturnable() {
    setError("");
    setNonReturnableSuccess(false);
    setSavingNonReturnable(true);
    try {
      await saveKey(NON_RETURNABLE_ENABLED_KEY, nonReturnableEnabled ? "true" : "false");
      setNonReturnableSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingNonReturnable(false);
    }
  }

  async function handleSaveBadges() {
    setError("");
    setBadgesSuccess(false);
    setSavingBadges(true);
    try {
      for (const b of TRUST_BADGES) {
        await saveKey(b.enabledKey, badgeEnabled[b.enabledKey] ? "true" : "false");
        await saveKey(b.textKey, badgeText[b.textKey] ?? "");
      }
      setBadgesSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingBadges(false);
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

        <div>
          <p className="text-sm font-bold mb-1">متنِ باکسِ بنفشِ پوسترِ اینستاگرام</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            هر خط رو جدا بنویس (Enter بین خط‌ها) -- توی «پوستر اینستاگرام» بالای ستونِ اطلاعات نشون داده می‌شه.
          </p>
          <textarea
            value={posterCurrencyText}
            onChange={(e) => setPosterCurrencyText(e.target.value)}
            rows={2}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">درباره ما (صفحه‌ی /about)</p>
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            rows={4}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">قوانین و مقررات (صفحه‌ی /terms)</p>
          <textarea
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            rows={6}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">حریم خصوصی (صفحه‌ی /privacy)</p>
          <textarea
            value={privacyText}
            onChange={(e) => setPrivacyText(e.target.value)}
            rows={4}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">سوالات پرتکرار (صفحه‌ی /faq)</p>
          <textarea
            value={faqText}
            onChange={(e) => setFaqText(e.target.value)}
            rows={6}
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
          <p className="text-sm font-bold">مراحلِ سفارش</p>
          <p className="text-[10px] text-[var(--color-muted)] mt-1">
            هر مرحله رو می‌شه خاموش کرد تا سریع‌تر و خودکارتر انجام بشه. پیش‌فرض همه روشنن (رفتارِ فعلی).
          </p>
        </div>
        {STAGE_TOGGLES.map((toggle) => {
          const checked = stageActive[toggle.key] !== false;
          return (
            <label key={toggle.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setStageActive((prev) => ({ ...prev, [toggle.key]: e.target.checked }))}
                className="mt-1"
              />
              <span>
                <span className="text-sm font-bold block">{toggle.title}</span>
                <span className="text-[11px] text-[var(--color-muted)]">
                  {checked ? "فعال -- رفتارِ فعلی، بدونِ تغییر" : `خاموش: ${toggle.whenOff}`}
                </span>
              </span>
            </label>
          );
        })}
        {stagesSuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}
        <button
          onClick={handleSaveStages}
          disabled={savingStages}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingStages ? "در حال ذخیره..." : "ذخیره مراحل"}
        </button>
      </div>

      <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <p className="text-sm font-bold">هشدارِ موجودیِ کم</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockEnabled}
            onChange={(e) => setLowStockEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="text-sm font-bold block">وقتی موجودیِ یه ترکیب کم شد به من خبر بده</span>
            <span className="text-[11px] text-[var(--color-muted)]">
              خاموش پیش‌فرضه -- روشن که باشه، از داشبورد اعلان می‌گیری (حداکثر روزی یه‌بار به‌ازای هر ترکیب).
            </span>
          </span>
        </label>
        {lowStockEnabled && (
          <div className="max-w-[160px]">
            <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">آستانه‌ی موجودیِ کم (تعداد)</label>
            <input
              type="number"
              min={1}
              value={thresholds[LOW_STOCK_THRESHOLD_KEY] ?? "5"}
              onChange={(e) => setThresholds((prev) => ({ ...prev, [LOW_STOCK_THRESHOLD_KEY]: e.target.value }))}
              className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
            />
          </div>
        )}
        {lowStockSuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}
        <button
          onClick={handleSaveLowStock}
          disabled={savingLowStock}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingLowStock ? "در حال ذخیره..." : "ذخیره"}
        </button>
      </div>

      <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <p className="text-sm font-bold">پرداخت در محل</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={cashOnDeliveryEnabled}
            onChange={(e) => setCashOnDeliveryEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="text-sm font-bold block">مشتری بتواند «پرداخت در محل» را در چک‌اوت انتخاب کند</span>
            <span className="text-[11px] text-[var(--color-muted)]">
              خاموش پیش‌فرضه -- روشن که باشه، مشتری می‌تونه به‌جای کارت‌به‌کارت، کل مبلغ (و هزینه ارسال) رو نقدی موقع تحویل بده؛ برای این سفارش‌ها هیچ کارتی تخصیص داده نمی‌شه.
            </span>
          </span>
        </label>
        {codSuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}
        <button
          onClick={handleSaveCod}
          disabled={savingCod}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingCod ? "در حال ذخیره..." : "ذخیره"}
        </button>
      </div>

      <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <p className="text-sm font-bold">محصولات غیرقابل‌بازگشت</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={nonReturnableEnabled}
            onChange={(e) => setNonReturnableEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="text-sm font-bold block">اجازه بده بعضی محصولات از قابلیت مرجوعی مستثنی باشن</span>
            <span className="text-[11px] text-[var(--color-muted)]">
              خاموش پیش‌فرضه (رفتارِ فعلی، همه‌چیز قابل‌مرجوعه). روشن که باشه، دو تیک جدا اعمال می‌شه: تیکِ «قابل مرجوع» توی فرمِ هر محصولِ مزون (پنل محصولات)، و تیکِ «قابل مرجوع» توی هر سایتِ خارجی (پنل «سایت‌های خارجی») -- چون مثلاً ممکنه ترندیول مرجوعی داشته باشه ولی میلا نداشته باشه. هرکدوم که تیک نداره، مشتری اصلاً نمی‌تونه براش درخواست مرجوعی بده.
            </span>
          </span>
        </label>
        {nonReturnableSuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}
        <button
          onClick={handleSaveNonReturnable}
          disabled={savingNonReturnable}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingNonReturnable ? "در حال ذخیره..." : "ذخیره"}
        </button>
      </div>

      <div className="border cut-line rounded-lg p-4 bg-white space-y-4">
        <div>
          <p className="text-sm font-bold">نوار بج‌های اعتماد</p>
          <p className="text-[10px] text-[var(--color-muted)] mt-1">
            پایینِ همه‌ی صفحات (بالای فوتر) نشون داده می‌شه -- هرکدوم رو جدا روشن/خاموش کن و متنش رو دلخواه بنویس.
          </p>
        </div>
        {TRUST_BADGES.map((b) => (
          <div key={b.n} className="flex items-start gap-3">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={badgeEnabled[b.enabledKey] ?? false}
                onChange={(e) => setBadgeEnabled((prev) => ({ ...prev, [b.enabledKey]: e.target.checked }))}
              />
              <span>{b.icon}</span>
            </label>
            <input
              type="text"
              value={badgeText[b.textKey] ?? ""}
              onChange={(e) => setBadgeText((prev) => ({ ...prev, [b.textKey]: e.target.value }))}
              placeholder="متن بج..."
              className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>
        ))}
        {badgesSuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}
        <button
          onClick={handleSaveBadges}
          disabled={savingBadges}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingBadges ? "در حال ذخیره..." : "ذخیره بج‌ها"}
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

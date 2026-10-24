"use client";

import { useEffect, useState } from "react";

// همه‌ی تنظیماتِ غیرمتنی که قبلاً توی صفحه‌ی «متن‌های سایت» قاطی شده بودن --
// طبقِ خواسته‌ی صریح: اون صفحه فقط باید متن‌های واقعی (درباره‌ما/قوانین/...) رو
// داشته باشه، بقیه‌ی چیزها (تیک‌ها، آستانه‌های عددی، ...) اینجا اومدن
const SALES_PAUSED_ENABLED_KEY = "salesPausedEnabled";
const SALES_PAUSED_MESSAGE_KEY = "salesPausedMessage";
const MIN_DISCOUNT_PERCENT_TO_SHOW_KEY = "minDiscountPercentToShow";
const SOCIAL_PROOF_WINDOW_MINUTES_KEY = "socialProofWindowMinutes";
const CLIENT_POLL_INTERVAL_SECONDS_KEY = "clientPollIntervalSeconds";
const TRENDYOL_STALE_FALLBACK_HOURS_KEY = "trendyolStaleFallbackHours";
const SOCIAL_PROOF_MIN_COUNT_KEY = "socialProofMinCount";
const CROSS_SELL_MAX_ITEMS_KEY = "crossSellMaxItems";
const SUPPORT_WHATSAPP_NUMBER_KEY = "supportWhatsappNumber";
const SUPPORT_TELEGRAM_USERNAME_KEY = "supportTelegramUsername";

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
const SELF_SERVICE_RETURN_KEY = "selfServiceReturnEnabled";
const SHIPPING_INFO_KEY = "shippingInfoEnabled";

// کسراژِ وفاداری -- موتورش (اجرا بعد از تحویلِ کاملِ سفارش) از قبل توی
// giftCard.ts/loyaltyTier.ts پیاده‌سازی شده، اینجا فقط پارامترهاش قابل‌تنظیمن
const LOYALTY_ENABLED_KEY = "loyaltyCashbackEnabled";
const LOYALTY_NUMERIC_KEYS = {
  percent: "loyaltyCashbackPercent",
  tomanPerPoint: "loyaltyTomanPerPoint",
  silverMinPoints: "loyaltySilverMinPoints",
  silverBonusPercent: "loyaltySilverBonusPercent",
  goldMinPoints: "loyaltyGoldMinPoints",
  goldBonusPercent: "loyaltyGoldBonusPercent",
} as const;
const LOYALTY_SILVER_FREE_SHIPPING_KEY = "loyaltySilverFreeShipping";
const LOYALTY_GOLD_FREE_SHIPPING_KEY = "loyaltyGoldFreeShipping";

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

export default function AdminOtherSettingsPage() {
  const [salesPausedEnabled, setSalesPausedEnabled] = useState(false);
  const [salesPausedMessage, setSalesPausedMessage] = useState("");
  const [savingSalesPaused, setSavingSalesPaused] = useState(false);
  const [salesPausedSuccess, setSalesPausedSuccess] = useState(false);
  const [thresholds, setThresholds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [displaySuccess, setDisplaySuccess] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [error, setError] = useState("");
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
  const [selfServiceReturnEnabled, setSelfServiceReturnEnabled] = useState(true);
  const [savingSelfServiceReturn, setSavingSelfServiceReturn] = useState(false);
  const [selfServiceReturnSuccess, setSelfServiceReturnSuccess] = useState(false);
  const [shippingInfoEnabled, setShippingInfoEnabled] = useState(true);
  const [savingShippingInfo, setSavingShippingInfo] = useState(false);
  const [shippingInfoSuccess, setShippingInfoSuccess] = useState(false);
  const [badgeEnabled, setBadgeEnabled] = useState<Record<string, boolean>>({});
  const [badgeText, setBadgeText] = useState<Record<string, string>>({});
  const [savingBadges, setSavingBadges] = useState(false);
  const [badgesSuccess, setBadgesSuccess] = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [loyaltyValues, setLoyaltyValues] = useState<Record<string, string>>({});
  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const [loyaltySuccess, setLoyaltySuccess] = useState(false);
  const [silverFreeShipping, setSilverFreeShipping] = useState(false);
  const [goldFreeShipping, setGoldFreeShipping] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : Promise.resolve({} as Record<string, string>)))
      .then((data: Record<string, string>) => {
        setSalesPausedEnabled(data[SALES_PAUSED_ENABLED_KEY] === "true");
        setSalesPausedMessage(data[SALES_PAUSED_MESSAGE_KEY] ?? "");
        setThresholds(data);
        setStageActive(
          Object.fromEntries(STAGE_TOGGLES.map((t) => [t.key, data[t.key] !== "true"]))
        );
        setLowStockEnabled(data[LOW_STOCK_ENABLED_KEY] === "true");
        setCashOnDeliveryEnabled(data[CASH_ON_DELIVERY_KEY] === "true");
        setNonReturnableEnabled(data[NON_RETURNABLE_ENABLED_KEY] === "true");
        setSelfServiceReturnEnabled(data[SELF_SERVICE_RETURN_KEY] !== "false");
        setShippingInfoEnabled(data[SHIPPING_INFO_KEY] !== "false");
        setBadgeEnabled(
          Object.fromEntries(TRUST_BADGES.map((b) => [b.enabledKey, data[b.enabledKey] === "true"]))
        );
        setBadgeText(Object.fromEntries(TRUST_BADGES.map((b) => [b.textKey, data[b.textKey] ?? ""])));
        setLoyaltyEnabled(data[LOYALTY_ENABLED_KEY] !== "false");
        setLoyaltyValues(
          Object.fromEntries(Object.values(LOYALTY_NUMERIC_KEYS).map((k) => [k, data[k] ?? ""]))
        );
        setSilverFreeShipping(data[LOYALTY_SILVER_FREE_SHIPPING_KEY] === "true");
        setGoldFreeShipping(data[LOYALTY_GOLD_FREE_SHIPPING_KEY] === "true");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveSalesPaused() {
    setError("");
    setSalesPausedSuccess(false);
    setSavingSalesPaused(true);
    try {
      await saveKey(SALES_PAUSED_ENABLED_KEY, salesPausedEnabled ? "true" : "false");
      await saveKey(SALES_PAUSED_MESSAGE_KEY, salesPausedMessage);
      setSalesPausedSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingSalesPaused(false);
    }
  }

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

  async function handleSaveDisplay() {
    setError("");
    setDisplaySuccess(false);
    setSavingDisplay(true);
    try {
      await saveKey(MIN_DISCOUNT_PERCENT_TO_SHOW_KEY, thresholds[MIN_DISCOUNT_PERCENT_TO_SHOW_KEY] || "2");
      await saveKey(SOCIAL_PROOF_WINDOW_MINUTES_KEY, thresholds[SOCIAL_PROOF_WINDOW_MINUTES_KEY] || "10");
      await saveKey(CLIENT_POLL_INTERVAL_SECONDS_KEY, thresholds[CLIENT_POLL_INTERVAL_SECONDS_KEY] || "30");
      await saveKey(TRENDYOL_STALE_FALLBACK_HOURS_KEY, thresholds[TRENDYOL_STALE_FALLBACK_HOURS_KEY] || "24");
      await saveKey(SOCIAL_PROOF_MIN_COUNT_KEY, thresholds[SOCIAL_PROOF_MIN_COUNT_KEY] || "2");
      await saveKey(CROSS_SELL_MAX_ITEMS_KEY, thresholds[CROSS_SELL_MAX_ITEMS_KEY] || "4");
      await saveKey(SUPPORT_WHATSAPP_NUMBER_KEY, thresholds[SUPPORT_WHATSAPP_NUMBER_KEY] ?? "");
      await saveKey(SUPPORT_TELEGRAM_USERNAME_KEY, thresholds[SUPPORT_TELEGRAM_USERNAME_KEY] ?? "");
      setDisplaySuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingDisplay(false);
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

  async function handleSaveSelfServiceReturn() {
    setError("");
    setSelfServiceReturnSuccess(false);
    setSavingSelfServiceReturn(true);
    try {
      await saveKey(SELF_SERVICE_RETURN_KEY, selfServiceReturnEnabled ? "true" : "false");
      setSelfServiceReturnSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingSelfServiceReturn(false);
    }
  }

  async function handleSaveShippingInfo() {
    setError("");
    setShippingInfoSuccess(false);
    setSavingShippingInfo(true);
    try {
      await saveKey(SHIPPING_INFO_KEY, shippingInfoEnabled ? "true" : "false");
      setShippingInfoSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingShippingInfo(false);
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

  async function handleSaveLoyalty() {
    setError("");
    setLoyaltySuccess(false);
    setSavingLoyalty(true);
    try {
      await saveKey(LOYALTY_ENABLED_KEY, loyaltyEnabled ? "true" : "false");
      for (const key of Object.values(LOYALTY_NUMERIC_KEYS)) {
        await saveKey(key, loyaltyValues[key] ?? "");
      }
      await saveKey(LOYALTY_SILVER_FREE_SHIPPING_KEY, silverFreeShipping ? "true" : "false");
      await saveKey(LOYALTY_GOLD_FREE_SHIPPING_KEY, goldFreeShipping ? "true" : "false");
      setLoyaltySuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSavingLoyalty(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">سایر تنظیمات</h1>

      <div className="border-2 border-amber-500 rounded-lg p-4 bg-amber-50 space-y-3">
        <p className="text-sm font-bold">⏸️ حالتِ «فقط-نمایش» (توقفِ موقتِ فروش)</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={salesPausedEnabled}
            onChange={(e) => setSalesPausedEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="text-sm font-bold block">فروشِ کلِ سایت موقتاً متوقف بشه</span>
            <span className="text-[11px] text-[var(--color-muted)]">
              خاموش پیش‌فرضه. روشن که باشه: محصولات/صفحات عادی دیده می‌شن (فقط-نمایش)، ولی نه دکمه‌ی
              «افزودن به سبد»/«همین الان بخر» نشون داده می‌شه نه ثبتِ سفارش ممکنه -- حتی اگه کسی مستقیم
              درخواست بزنه. یه پیامِ آگاه‌سازی هم بالای همه‌ی صفحات نشون داده می‌شه.
            </span>
          </span>
        </label>
        <div>
          <p className="text-[11px] text-[var(--color-muted)] mb-1">پیامی که به مشتری نشون داده می‌شه</p>
          <textarea
            value={salesPausedMessage}
            onChange={(e) => setSalesPausedMessage(e.target.value)}
            rows={2}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>
        {salesPausedSuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}
        <button
          onClick={handleSaveSalesPaused}
          disabled={savingSalesPaused}
          className="bg-amber-600 text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingSalesPaused ? "در حال ذخیره..." : "ذخیره"}
        </button>
      </div>

      <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <p className="text-sm font-bold">نمایش و کشف محصول</p>
        <div>
          <p className="text-sm font-bold mb-1">حداقلِ درصدِ تخفیفِ قابلِ‌نمایش</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            تخفیفی که درصدش کمتر از این عدد باشه (مثلاً ۱٪) هیچ‌جا -- لیستِ محصولات،
            نگاهِ سریع، پوستر -- به‌صورتِ عدد نشون داده نمی‌شه (فقط قیمتِ خط‌خورده می‌مونه).
          </p>
          <input
            type="number"
            min={0}
            max={99}
            value={thresholds[MIN_DISCOUNT_PERCENT_TO_SHOW_KEY] ?? ""}
            onChange={(e) =>
              setThresholds((prev) => ({ ...prev, [MIN_DISCOUNT_PERCENT_TO_SHOW_KEY]: e.target.value }))
            }
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">«این محصول رو خریدن، این‌ها رو هم خریدن»</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            حداکثر چندتا محصول توی این بخش (روی صفحه‌ی محصولِ مزون و ترندیول/میلا) نشون داده بشه --
            بر اساسِ هم‌خریدیِ واقعیِ سفارش‌های پرداخت‌شده. روشن/خاموش‌کردنِ کلِ این بخش از صفحه‌ی
            «امکاناتِ فروشگاه» انجام می‌شه.
          </p>
          <input
            type="number"
            min={1}
            max={12}
            value={thresholds[CROSS_SELL_MAX_ITEMS_KEY] ?? ""}
            onChange={(e) => setThresholds((prev) => ({ ...prev, [CROSS_SELL_MAX_ITEMS_KEY]: e.target.value }))}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">به‌روزرسانیِ خودکار (ثانیه)</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            هر چند ثانیه بجِ پیام‌ها، پیام‌های سفارش و وضعیتِ سفارش برای کاربرِ لاگین‌شده خودکار به‌روز بشن
            (فقط وقتی صفحه باز و جلوی چشمه). عددِ کمتر یعنی به‌روزتر ولی درخواستِ بیشتر به سرور و
            دیتابیس؛ حداقل ۵.
          </p>
          <input
            type="number"
            min={5}
            max={600}
            value={thresholds[CLIENT_POLL_INTERVAL_SECONDS_KEY] ?? ""}
            placeholder="30"
            onChange={(e) =>
              setThresholds((prev) => ({ ...prev, [CLIENT_POLL_INTERVAL_SECONDS_KEY]: e.target.value }))
            }
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">نمایشِ نتیجه‌ی ذخیره‌شده وقتی ترندیول در دسترس نیست (ساعت)</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            اگه ترندیول درخواستِ سایت رو بلاک کنه، به‌جای پیامِ خطا آخرین لیستِ ذخیره‌شده با برچسبِ
            «ممکنه به‌روز نباشه» نشون داده می‌شه -- به شرطی که از این تعداد ساعت قدیمی‌تر نباشه. قیمت‌ها
            ممکنه با قیمتِ فعلیِ ترندیول فرق داشته باشن. ۰ یعنی خاموش.
          </p>
          <input
            type="number"
            min={0}
            max={720}
            value={thresholds[TRENDYOL_STALE_FALLBACK_HOURS_KEY] ?? ""}
            placeholder="24"
            onChange={(e) =>
              setThresholds((prev) => ({ ...prev, [TRENDYOL_STALE_FALLBACK_HOURS_KEY]: e.target.value }))
            }
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">نشانه‌ی اجتماعیِ لحظه‌ای (روی صفحه‌ی محصول)</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            «N نفر توی چند دقیقه‌ی اخیر این محصول رو دیده‌اند» -- دیتای واقعیه، از رویِ
            بازدیدهایِ ثبت‌شده. اگه تعداد از حداقل کمتر باشه، اصلاً نشون داده نمی‌شه.
          </p>
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-[10px] text-[var(--color-muted)] mb-1">بازه‌ی زمانی (دقیقه)</span>
              <input
                type="number"
                min={1}
                max={120}
                value={thresholds[SOCIAL_PROOF_WINDOW_MINUTES_KEY] ?? ""}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, [SOCIAL_PROOF_WINDOW_MINUTES_KEY]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
              />
            </label>
            <label className="flex-1">
              <span className="block text-[10px] text-[var(--color-muted)] mb-1">حداقلِ تعداد برایِ نمایش</span>
              <input
                type="number"
                min={1}
                max={50}
                value={thresholds[SOCIAL_PROOF_MIN_COUNT_KEY] ?? ""}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, [SOCIAL_PROOF_MIN_COUNT_KEY]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
              />
            </label>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold mb-1">دکمه‌ی سریعِ واتس‌اپ/تلگرام (کنارِ چتِ زنده)</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            هرکدوم خالی باشه، دکمه‌ش اصلاً نشون داده نمی‌شه. این دو (برخلافِ خودِ چت)
            برای مهمان‌های لاگین‌نکرده هم نشون داده می‌شن.
          </p>
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-[10px] text-[var(--color-muted)] mb-1">
                شماره‌ی واتس‌اپ (فرمتِ بین‌المللی، بدونِ +، مثلِ ۹۸۹۱۲۳۴۵۶۷۸۹)
              </span>
              <input
                type="text"
                dir="ltr"
                placeholder="989123456789"
                value={thresholds[SUPPORT_WHATSAPP_NUMBER_KEY] ?? ""}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, [SUPPORT_WHATSAPP_NUMBER_KEY]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
              />
            </label>
            <label className="flex-1">
              <span className="block text-[10px] text-[var(--color-muted)] mb-1">
                نامِ کاربریِ تلگرام (بدونِ @)
              </span>
              <input
                type="text"
                dir="ltr"
                placeholder="mudashop_support"
                value={thresholds[SUPPORT_TELEGRAM_USERNAME_KEY] ?? ""}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, [SUPPORT_TELEGRAM_USERNAME_KEY]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
              />
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {displaySuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}

        <button
          onClick={handleSaveDisplay}
          disabled={savingDisplay}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingDisplay ? "در حال ذخیره..." : "ذخیره تغییرات"}
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

      <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <p className="text-sm font-bold">مرجوعیِ خودخدمتِ مشتری</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={selfServiceReturnEnabled}
            onChange={(e) => setSelfServiceReturnEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="text-sm font-bold block">
              مشتری از صفحه‌ی سفارشِ خودش بتونه درخواستِ مرجوعیِ تازه ثبت کنه
            </span>
            <span className="text-[11px] text-[var(--color-muted)]">
              روشن پیش‌فرضه (رفتارِ فعلی). خاموش که باشه، به‌جایِ دکمه/فرمِ «درخواست مرجوعی»، پیامِ
              «برای مرجوعی با پشتیبانی تماس بگیرید» نشون داده می‌شه -- یعنی مرجوعی کاملاً دستی/تلفنی
              می‌شه. این جدا از تیکِ بالاست (اون کدوم محصول/سایت اصلاً مرجوع‌پذیره، این خودِ فرآیندِ
              خودخدمت رو روشن/خاموش می‌کنه). درخواست‌هایی که از قبل ثبت شدن، همچنان قابلِ پیگیری‌ان.
            </span>
          </span>
        </label>
        {selfServiceReturnSuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}
        <button
          onClick={handleSaveSelfServiceReturn}
          disabled={savingSelfServiceReturn}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingSelfServiceReturn ? "در حال ذخیره..." : "ذخیره"}
        </button>
      </div>

      <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <p className="text-sm font-bold">شفافیتِ هزینه/زمانِ ارسال</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={shippingInfoEnabled}
            onChange={(e) => setShippingInfoEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="text-sm font-bold block">
              کنارِ دکمه‌ی «افزودن به سبد» توی صفحه‌ی هر محصول، هزینه/زمانِ ارسال نشون داده بشه
            </span>
            <span className="text-[11px] text-[var(--color-muted)]">
              روشن پیش‌فرضه. برای محصولاتِ مزون، هزینه‌ی ثابتِ ارسال + آستانه‌ی ارسالِ رایگان + بازه‌ی
              روزِ تحویل (از همون تنظیماتِ ارسال/چک‌اوت) نشون داده می‌شه. برای محصولاتِ ترندیول، چون
              هزینه‌ی باربری قبل از خرید معلوم نیست، به‌جاش توضیح داده می‌شه که هزینه بعد از خرید و
              وزن‌کشی مشخص می‌شه، به‌همراه بازه‌ی تقریبیِ رسیدن.
            </span>
          </span>
        </label>
        {shippingInfoSuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}
        <button
          onClick={handleSaveShippingInfo}
          disabled={savingShippingInfo}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingShippingInfo ? "در حال ذخیره..." : "ذخیره"}
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

      <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <div>
          <p className="text-sm font-bold">کسراژ وفاداری</p>
          <p className="text-[10px] text-[var(--color-muted)] mt-1">
            بعد از تحویلِ کاملِ هر سفارش، درصدی از مبلغش به‌عنوانِ کسراژ به کیف‌پولِ مشتری اضافه می‌شه.
            هر مشتری هم‌زمان امتیاز جمع می‌کنه که با رسیدن به آستانه‌ها سطحش (نقره‌ای/طلایی) بالا می‌ره و
            درصدِ کسراژش هم بیشتر می‌شه. صفحه‌ی مشتری: /loyalty (لینک‌شده از پروفایل).
          </p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={loyaltyEnabled}
            onChange={(e) => setLoyaltyEnabled(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm font-bold">کسراژ وفاداری فعال باشد</span>
        </label>
        {loyaltyEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">درصدِ کسراژِ پایه (٪)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={loyaltyValues[LOYALTY_NUMERIC_KEYS.percent] ?? ""}
                onChange={(e) =>
                  setLoyaltyValues((prev) => ({ ...prev, [LOYALTY_NUMERIC_KEYS.percent]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">هر چند تومانِ خرید = ۱ امتیاز</label>
              <input
                type="number"
                min={1}
                value={loyaltyValues[LOYALTY_NUMERIC_KEYS.tomanPerPoint] ?? ""}
                onChange={(e) =>
                  setLoyaltyValues((prev) => ({ ...prev, [LOYALTY_NUMERIC_KEYS.tomanPerPoint]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">آستانه‌ی سطحِ نقره‌ای (امتیاز)</label>
              <input
                type="number"
                min={0}
                value={loyaltyValues[LOYALTY_NUMERIC_KEYS.silverMinPoints] ?? ""}
                onChange={(e) =>
                  setLoyaltyValues((prev) => ({ ...prev, [LOYALTY_NUMERIC_KEYS.silverMinPoints]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">پاداشِ سطحِ نقره‌ای (٪ اضافه)</label>
              <input
                type="number"
                min={0}
                value={loyaltyValues[LOYALTY_NUMERIC_KEYS.silverBonusPercent] ?? ""}
                onChange={(e) =>
                  setLoyaltyValues((prev) => ({ ...prev, [LOYALTY_NUMERIC_KEYS.silverBonusPercent]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">آستانه‌ی سطحِ طلایی (امتیاز)</label>
              <input
                type="number"
                min={0}
                value={loyaltyValues[LOYALTY_NUMERIC_KEYS.goldMinPoints] ?? ""}
                onChange={(e) =>
                  setLoyaltyValues((prev) => ({ ...prev, [LOYALTY_NUMERIC_KEYS.goldMinPoints]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">پاداشِ سطحِ طلایی (٪ اضافه)</label>
              <input
                type="number"
                min={0}
                value={loyaltyValues[LOYALTY_NUMERIC_KEYS.goldBonusPercent] ?? ""}
                onChange={(e) =>
                  setLoyaltyValues((prev) => ({ ...prev, [LOYALTY_NUMERIC_KEYS.goldBonusPercent]: e.target.value }))
                }
                className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
              />
            </div>
          </div>
        )}
        {loyaltyEnabled && (
          <div className="space-y-2 pt-2 border-t cut-line">
            <p className="text-sm font-bold">مزیتِ باشگاه مشتریان: ارسالِ رایگانِ نامحدود</p>
            <p className="text-[10px] text-[var(--color-muted)]">
              فقط سفارش‌های بدونِ کالای خارجی (باربریِ خارجی همیشه دستی و جداست).
            </p>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={silverFreeShipping}
                onChange={(e) => setSilverFreeShipping(e.target.checked)}
              />
              🥈 سطحِ نقره‌ای
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={goldFreeShipping}
                onChange={(e) => setGoldFreeShipping(e.target.checked)}
              />
              🥇 سطحِ طلایی
            </label>
          </div>
        )}
        {loyaltySuccess && <p className="text-sm text-green-700">ذخیره شد.</p>}
        <button
          onClick={handleSaveLoyalty}
          disabled={savingLoyalty}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {savingLoyalty ? "در حال ذخیره..." : "ذخیره"}
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyInput } from "@/components/CurrencyInput";
import { SHIPPING_METHODS, NO_COST_SHIPPING_METHODS } from "@/lib/shipping";
import { parseTrackingCodes } from "@/lib/trackingCodes";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پردازش",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

type BankCardOption = {
  id: string;
  cardNumber: string;
  holderName: string;
  label: string | null;
};

type ShippingPaymentInfo = {
  status: string;
  amount: number;
  receiptImage: string | null;
};

type ExternalItemForCargo = {
  id: string;
  title: string;
  quantity: number;
  price: number;
  purchaseStatus: string;
  purchasePriceActual: number | null;
  itemWeightGrams: number | null;
  itemCargoCost: number | null;
};

export function AdminOrderActions({
  orderId,
  status,
  paymentStatus,
  paymentMethod,
  freeShippingApplied,
  receiptImage,
  bankCards,
  hasExternalItems,
  shippingMethod,
  shippingPayment,
  itemsNegotiationStatus,
  trackingCode,
  externalItems,
  cargoRatePerKgDefault,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  freeShippingApplied: boolean;
  receiptImage: string | null;
  bankCards: BankCardOption[];
  hasExternalItems: boolean;
  shippingMethod: string | null;
  shippingPayment: ShippingPaymentInfo | null;
  itemsNegotiationStatus: string;
  trackingCode: string | null;
  externalItems?: ExternalItemForCargo[];
  cargoRatePerKgDefault?: string;
}) {
  const router = useRouter();
  const [selectedCardId, setSelectedCardId] = useState(bankCards[0]?.id ?? "");
  const [shippingCostInput, setShippingCostInput] = useState("");
  // فقط برای fallback سفارش‌های قدیمی/بدون نحوه‌ی از پیش‌تعیین‌شده -- سفارش‌های
  // فقط-مزونِ جدید نحوه‌ی ارسالشون رو از قبل توی چک‌اوت انتخاب کردن (prop بالا)
  const [shippingMethodInput, setShippingMethodInput] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [error, setError] = useState("");

  // فرم لغو (نیازمند دلیل) و فرم ثبت ارسال (نیازمند کد رهگیری/شماره پیک) --
  // هر دو به‌جای اجرای فوری، اول یه ورودی کوچیک باز می‌کنن
  const [cancelFormOpen, setCancelFormOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [shipFormOpen, setShipFormOpen] = useState(false);
  // برگشت‌خوردنِ بسته توسط پست/پیک -- برای مزون و خارجی هر دو معنی داره،
  // چون هر دو ممکنه دوباره نیاز به هزینه ارسال و کد رهگیری داشته باشن
  const [returnedFormOpen, setReturnedFormOpen] = useState(false);
  const [returnedReason, setReturnedReason] = useState("");
  const [markingReturned, setMarkingReturned] = useState(false);
  // سفارش ممکنه توی چندتا بسته‌ی جدا ارسال بشه -- پس یه آرایه از ورودی‌ها،
  // نه یه ورودی تکی. همیشه حداقل یه ردیف خالی برای شروع
  const [trackingCodeInputs, setTrackingCodeInputs] = useState<string[]>([""]);
  // ویرایش کدهای رهگیری بعد از ثبت ارسال (مثلاً اگه اشتباه تایپ شده بود یا
  // بسته‌ی جدیدی اضافه شد)
  const [editTrackingOpen, setEditTrackingOpen] = useState(false);
  const currentTrackingCodes = parseTrackingCodes(trackingCode);
  const [editTrackingInputs, setEditTrackingInputs] = useState<string[]>(
    currentTrackingCodes.length > 0 ? currentTrackingCodes : [""]
  );
  // رد فیش پرداخت (دور اول) هم عملاً یه لغو سفارشه -- همون‌جوری دلیل می‌خواد
  const [rejectPaymentFormOpen, setRejectPaymentFormOpen] = useState(false);
  const [rejectPaymentReason, setRejectPaymentReason] = useState("");
  // رد فیش هزینه ارسال/باربری (دور دوم) هم دلیل می‌خواد
  const [rejectShippingFormOpen, setRejectShippingFormOpen] = useState(false);
  const [rejectShippingReason, setRejectShippingReason] = useState("");

  // دور دوم (هزینه ارسال نهایی سفارش خارجی، بعد از وزن‌کشی)
  const [finalShippingCardId, setFinalShippingCardId] = useState(bankCards[0]?.id ?? "");
  const [finalShippingCostInput, setFinalShippingCostInput] = useState("");
  // اگه از قبل (موقع ثبت نتیجه‌ی تگ) وزن/هزینه‌ی چندتا قلم ثبت شده باشه، جمع
  // کل رو همون اول محاسبه کن -- نه اینکه ادمین باید یه تغییر دستی بده تا
  // syncCargoTotal اولین بار صدا زده بشه
  const [finalCargoCostInput, setFinalCargoCostInput] = useState(() => {
    const rate = Number(cargoRatePerKgDefault ?? "0") || 0;
    const sum = (externalItems ?? []).reduce((acc, item) => {
      if (item.itemCargoCost != null) return acc + item.itemCargoCost;
      if (item.itemWeightGrams != null) return acc + Math.round((item.itemWeightGrams * rate) / 1000);
      return acc;
    }, 0);
    return sum > 0 ? String(sum) : "";
  });
  const [settingShippingCost, setSettingShippingCost] = useState(false);
  const [verifyingShipping, setVerifyingShipping] = useState(false);

  // ریز باربری هر قلم -- اختیاری؛ ادمین می‌تونه به‌جاش فقط جمع کل رو بالا بزنه.
  // اگه ادمین قبلاً (موقع ثبت نتیجه‌ی تگ، توی AdminItemPurchasePanel) وزن/هزینه‌ی
  // این قلم رو از قبل ثبت کرده باشه، همون‌ها این‌جا پیش‌فرض می‌شن -- نیازی نیست
  // دوباره تایپش کنه
  const [cargoBreakdownOpen, setCargoBreakdownOpen] = useState(false);
  const [cargoRateInput, setCargoRateInput] = useState(cargoRatePerKgDefault ?? "0");
  const [itemWeights, setItemWeights] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of externalItems ?? []) {
      if (item.itemWeightGrams != null) initial[item.id] = String(item.itemWeightGrams);
    }
    return initial;
  });
  const [itemCargoCosts, setItemCargoCosts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of externalItems ?? []) {
      if (item.itemCargoCost != null) initial[item.id] = String(item.itemCargoCost);
    }
    return initial;
  });

  const priceAdjustmentPreview = (externalItems ?? [])
    .filter((i) => (i.purchaseStatus === "PURCHASED" || i.purchaseStatus === "RECEIVED") && i.purchasePriceActual != null)
    .reduce((sum, i) => sum + (i.purchasePriceActual! - i.price) * i.quantity, 0);

  function computedItemCargoCost(itemId: string): number {
    const explicit = itemCargoCosts[itemId];
    if (explicit) return Number(explicit) || 0;
    const weight = itemWeights[itemId];
    if (weight) return Math.round((Number(weight) * (Number(cargoRateInput) || 0)) / 1000);
    return 0;
  }

  function syncCargoTotal(nextWeights: Record<string, string>, nextCosts: Record<string, string>, rate: string) {
    const sum = (externalItems ?? []).reduce((acc, item) => {
      const explicit = nextCosts[item.id];
      if (explicit) return acc + (Number(explicit) || 0);
      const weight = nextWeights[item.id];
      if (weight) return acc + Math.round((Number(weight) * (Number(rate) || 0)) / 1000);
      return acc;
    }, 0);
    setFinalCargoCostInput(String(sum));
  }

  // سفارش خارجی: هزینه ارسال همین‌جا معنی نداره (بعد از خرید/وزن‌کشی مشخص
  // می‌شه). برای سفارش فقط-مزون، نحوه‌ی ارسال معمولاً از چک‌اوت از قبل ست شده
  // (prop شیپینگ‌متد)؛ سلکت فقط به‌عنوان fallback سفارش‌های بدون نحوه نشون داده
  // می‌شه. اگه نحوه‌ی ارسال پیک/تیپاکس باشه، هزینه‌ای لازم نیست (مستقیم پرداخت می‌شه)
  const effectiveMethod = shippingMethod || shippingMethodInput || null;
  const isNoCostMethod = effectiveMethod
    ? NO_COST_SHIPPING_METHODS.includes(effectiveMethod as (typeof NO_COST_SHIPPING_METHODS)[number])
    : false;
  const showCostInput = !freeShippingApplied && !hasExternalItems && !isNoCostMethod;
  const showMethodSelect = !hasExternalItems && !shippingMethod;
  const showNoCostMethodNotice = !freeShippingApplied && !hasExternalItems && isNoCostMethod;
  const showExternalShippingNotice = hasExternalItems && !freeShippingApplied;

  // وضعیت‌ها دیگه با یه دراپ‌داون آزاد عوض نمی‌شن -- هر گذار فقط از راه یه
  // اقدام مشخص و مشروط انجام می‌شه، دقیقاً مثل بقیه‌ی اکشن‌های این کامپوننت.
  // «ثبت ارسال» فقط وقتی معنی داره که پرداخت اقلام تسویه شده، و برای سفارش
  // خارجی، پرداخت باربری هم تأیید شده باشه؛ «ثبت تحویل» فقط بعد از ارسال
  // اگه یه ردیف ShippingPayment وجود داره (چه سفارش خارجی باشه چه مزونی که
  // برگشت خورده و دوباره نیاز به هزینه ارسال داره)، باید حتماً PAID باشه؛
  // فقط سفارش مزونیِ عادی (که هیچ‌وقت ShippingPayment نداشته) از این شرط معافه
  const canMarkShipped =
    status === "PROCESSING" &&
    paymentStatus === "PAID" &&
    (shippingPayment ? shippingPayment.status === "PAID" : !hasExternalItems);
  const canMarkDelivered = status === "SHIPPED";
  // اگه پست/پیک نتونه تحویل بده و بسته برگردونده بشه -- برای مزون هم خارجی
  // هر دو معنی داره
  const canMarkReturnedToSender = status === "SHIPPED";
  const canCancel = !["CANCELLED", "DELIVERED", "RETURNED"].includes(status);
  // پیک موتوری یعنی مشتری خودش تحویل می‌گیره -- چیزی که باید بهش بدیم شماره
  // تماس پیکه، نه کد رهگیری؛ بقیه‌ی روش‌ها (پست/تیپاکس) کد رهگیری واقعی دارن
  const trackingCodeLabel = shippingMethod === "پیک موتوری" ? "شماره تماس پیک" : "کد رهگیری";

  async function updateStatus(newStatus: string, extra?: Record<string, string | string[]>): Promise<boolean> {
    setError("");
    setChangingStatus(true);
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, ...extra }),
    });
    setChangingStatus(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در تغییر وضعیت");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleCancelSubmit() {
    if (!cancelReason.trim()) {
      setError("لطفاً دلیل لغو را بنویسید");
      return;
    }
    await updateStatus("CANCELLED", { reason: cancelReason.trim() });
  }

  async function handleShipSubmit() {
    const codes = trackingCodeInputs.map((c) => c.trim()).filter(Boolean);
    if (codes.length === 0) {
      setError(`لطفاً حداقل یک ${trackingCodeLabel} وارد کنید`);
      return;
    }
    const ok = await updateStatus("SHIPPED", { trackingCodes: codes });
    // چون updateStatus فقط router.refresh() می‌زنه (نه remount کامل)، اگه اینجا
    // بسته نشه، فرمِ ثبتِ اولیه برای همیشه باز می‌مونه و بعد از موفقیت، هم‌زمان
    // با بخشِ «کد رهگیریِ ثبت‌شده» (که status=SHIPPED باعثِ نمایشش می‌شه) دیده
    // می‌شه -- یعنی همون دکمه‌ها/ورودی‌های تکراری و زیادی
    if (ok) {
      setShipFormOpen(false);
      setTrackingCodeInputs([""]);
    }
  }

  // ویرایش کدهای رهگیری بعد از ثبت ارسال -- status همون status فعلی سفارش
  // فرستاده می‌شه (نه لزوماً SHIPPED)، تا سرور بفهمه این یه گذار واقعی نیست
  async function handleUpdateTrackingCode() {
    const codes = editTrackingInputs.map((c) => c.trim()).filter(Boolean);
    if (codes.length === 0) {
      setError(`لطفاً حداقل یک ${trackingCodeLabel} وارد کنید`);
      return;
    }
    const ok = await updateStatus(status, { trackingCodes: codes });
    if (ok) setEditTrackingOpen(false);
  }

  async function handleFinalize() {
    setError("");
    setFinalizing(true);
    const res = await fetch(`/api/admin/orders/${orderId}/finalize-shipping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shippingCost: showCostInput ? Number(shippingCostInput || 0) : undefined,
        shippingMethod: showMethodSelect ? shippingMethodInput || undefined : undefined,
        bankCardId: selectedCardId || undefined,
      }),
    });
    setFinalizing(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت هزینه ارسال");
      return;
    }
    router.refresh();
  }

  async function verifyPayment(action: "approve" | "reject", reason?: string) {
    setVerifying(true);
    const res = await fetch(`/api/admin/orders/${orderId}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    setVerifying(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در پردازش");
      return;
    }
    router.refresh();
  }

  async function handleRejectPaymentSubmit() {
    if (!rejectPaymentReason.trim()) {
      setError("لطفاً دلیل رد پرداخت را بنویسید");
      return;
    }
    await verifyPayment("reject", rejectPaymentReason.trim());
  }

  async function handleSetShippingCost() {
    setError("");
    setSettingShippingCost(true);
    const res = await fetch(`/api/admin/orders/${orderId}/set-shipping-cost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shippingCost: Number(finalShippingCostInput || 0),
        cargoCost: Number(finalCargoCostInput || 0),
        bankCardId: finalShippingCardId || undefined,
        cargoRatePerKg: cargoBreakdownOpen ? Number(cargoRateInput || 0) : undefined,
        items: cargoBreakdownOpen
          ? (externalItems ?? [])
              .filter((item) => itemWeights[item.id] || itemCargoCosts[item.id])
              .map((item) => ({
                itemId: item.id,
                weightGrams: itemWeights[item.id] ? Number(itemWeights[item.id]) : undefined,
                cargoCost: itemCargoCosts[item.id] ? Number(itemCargoCosts[item.id]) : undefined,
              }))
          : undefined,
      }),
    });
    setSettingShippingCost(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت هزینه ارسال نهایی");
      return;
    }
    router.refresh();
  }

  async function verifyShippingPayment(action: "approve" | "reject", reason?: string) {
    setVerifyingShipping(true);
    const res = await fetch(`/api/admin/orders/${orderId}/verify-shipping-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    setVerifyingShipping(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در پردازش");
      return;
    }
    router.refresh();
  }

  async function handleRejectShippingSubmit() {
    if (!rejectShippingReason.trim()) {
      setError("لطفاً دلیل رد پرداخت را بنویسید");
      return;
    }
    await verifyShippingPayment("reject", rejectShippingReason.trim());
  }

  async function handleMarkReturnedToSender() {
    if (!returnedReason.trim()) {
      setError("لطفاً دلیل برگشت خوردن بسته را بنویسید");
      return;
    }
    setError("");
    setMarkingReturned(true);
    const res = await fetch(`/api/admin/orders/${orderId}/mark-returned-to-sender`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: returnedReason.trim() }),
    });
    setMarkingReturned(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت برگشت خوردن بسته");
      return;
    }
    setReturnedFormOpen(false);
    setReturnedReason("");
    router.refresh();
  }

  const finalizeDisabled =
    finalizing ||
    (showCostInput && !shippingCostInput) ||
    (showMethodSelect && !shippingMethodInput) ||
    itemsNegotiationStatus === "AWAITING_CUSTOMER_REVIEW";

  const canRetryShippingCost = !shippingPayment || shippingPayment.status === "FAILED";

  return (
    <section className="mb-8 border cut-line rounded-lg p-4 bg-white space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">اقدامات ادمین</h2>
        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--color-linen-dim)]">
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {paymentMethod === "CASH_ON_DELIVERY" && (
        <p className="text-xs bg-blue-50 text-blue-700 rounded-lg px-3 py-2">
          این سفارش «پرداخت در محل» است -- نیازی به تخصیص کارت یا منتظرِ فیش موندن نیست؛ کل مبلغ (و هزینه ارسال، اگر بود) موقع تحویل نقدی گرفته می‌شود.
        </p>
      )}

      {(canMarkShipped || canMarkDelivered || canMarkReturnedToSender || canCancel) && (
        <div className="flex flex-wrap items-center gap-2">
          {canMarkShipped && !shipFormOpen && (
            <button
              onClick={() => setShipFormOpen(true)}
              disabled={changingStatus}
              className="text-sm bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              ثبت ارسال
            </button>
          )}
          {canMarkDelivered && (
            <button
              onClick={() => updateStatus("DELIVERED")}
              disabled={changingStatus}
              className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              ثبت تحویل
            </button>
          )}
          {canMarkReturnedToSender && !returnedFormOpen && (
            <button
              onClick={() => setReturnedFormOpen(true)}
              disabled={changingStatus}
              className="text-sm border cut-line text-[var(--color-ochre)] px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              برگشت خورد
            </button>
          )}
          {canCancel && !cancelFormOpen && (
            <button
              onClick={() => setCancelFormOpen(true)}
              disabled={changingStatus}
              className="text-sm border cut-line text-red-600 px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              لغو سفارش
            </button>
          )}
        </div>
      )}

      {returnedFormOpen && (
        <div className="border cut-line rounded-lg p-3 space-y-2">
          <p className="text-xs text-[var(--color-muted)]">
            دلیل برگشت خوردن بسته (پست/پیک نتونست تحویل بده) -- سفارش به «در حال پردازش» برمی‌گرده و باید هزینه
            ارسال دوباره از مشتری گرفته شود
          </p>
          <textarea
            value={returnedReason}
            onChange={(e) => setReturnedReason(e.target.value)}
            placeholder="مثلاً آدرس اشتباه بود، مشتری در دسترس نبود..."
            rows={2}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkReturnedToSender}
              disabled={markingReturned}
              className="text-sm bg-[var(--color-ochre)] text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              {markingReturned ? "..." : "تأیید برگشت خوردن"}
            </button>
            <button
              onClick={() => {
                setReturnedFormOpen(false);
                setReturnedReason("");
                setError("");
              }}
              disabled={markingReturned}
              className="text-sm text-[var(--color-muted)] hover:underline disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {shipFormOpen && (
        <div className="border cut-line rounded-lg p-3 space-y-2">
          <p className="text-xs text-[var(--color-muted)]">
            {trackingCodeLabel} (اگه سفارش توی چندتا بسته‌ی جدا ارسال می‌شه، چندتا وارد کنید)
          </p>
          {trackingCodeInputs.map((code, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={code}
                onChange={(e) =>
                  setTrackingCodeInputs((prev) => prev.map((c, i) => (i === idx ? e.target.value : c)))
                }
                placeholder={`${trackingCodeLabel} ${trackingCodeInputs.length > 1 ? idx + 1 : ""}`}
                className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-sm bg-white"
                dir="ltr"
              />
              {trackingCodeInputs.length > 1 && (
                <button
                  onClick={() => setTrackingCodeInputs((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-red-600 text-sm px-2"
                  aria-label="حذف"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setTrackingCodeInputs((prev) => [...prev, ""])}
            className="text-xs text-[var(--color-wine)] hover:underline"
          >
            + افزودن {trackingCodeLabel} دیگر
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShipSubmit}
              disabled={changingStatus}
              className="text-sm bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              {changingStatus ? "..." : "تأیید ثبت ارسال"}
            </button>
            <button
              onClick={() => {
                setShipFormOpen(false);
                setTrackingCodeInputs([""]);
                setError("");
              }}
              disabled={changingStatus}
              className="text-sm text-[var(--color-muted)] hover:underline disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {(status === "SHIPPED" || status === "DELIVERED") && currentTrackingCodes.length > 0 && (
        <div className="border cut-line rounded-lg p-3 space-y-2">
          {!editTrackingOpen ? (
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--color-muted)]">
                {trackingCodeLabel}:{" "}
                {currentTrackingCodes.map((code, i) => (
                  <span key={i} className="font-bold text-[var(--color-ink)]" dir="ltr">
                    {code}
                    {i < currentTrackingCodes.length - 1 ? "، " : ""}
                  </span>
                ))}
              </div>
              {status !== "DELIVERED" && (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setEditTrackingInputs(currentTrackingCodes);
                      setEditTrackingOpen(true);
                    }}
                    className="text-xs text-[var(--color-wine)] hover:underline"
                  >
                    ویرایش
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--color-muted)]">ویرایش {trackingCodeLabel}</p>
              {editTrackingInputs.map((code, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={code}
                    onChange={(e) =>
                      setEditTrackingInputs((prev) => prev.map((c, i) => (i === idx ? e.target.value : c)))
                    }
                    placeholder={`${trackingCodeLabel} ${editTrackingInputs.length > 1 ? idx + 1 : ""}`}
                    className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-sm bg-white"
                    dir="ltr"
                  />
                  {editTrackingInputs.length > 1 && (
                    <button
                      onClick={() => setEditTrackingInputs((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-600 text-sm px-2"
                      aria-label="حذف"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setEditTrackingInputs((prev) => [...prev, ""])}
                className="text-xs text-[var(--color-wine)] hover:underline"
              >
                + افزودن {trackingCodeLabel} دیگر
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpdateTrackingCode}
                  disabled={changingStatus}
                  className="text-sm bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
                >
                  {changingStatus ? "..." : "ثبت اصلاحیه"}
                </button>
                <button
                  onClick={() => {
                    setEditTrackingOpen(false);
                    setError("");
                  }}
                  disabled={changingStatus}
                  className="text-sm text-[var(--color-muted)] hover:underline disabled:opacity-50"
                >
                  انصراف
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {cancelFormOpen && (
        <div className="border cut-line rounded-lg p-3 space-y-2">
          <p className="text-xs text-[var(--color-muted)]">دلیل لغو</p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="دلیل لغو را بنویسید..."
            rows={2}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelSubmit}
              disabled={changingStatus}
              className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              {changingStatus ? "..." : "تأیید لغو سفارش"}
            </button>
            <button
              onClick={() => {
                setCancelFormOpen(false);
                setCancelReason("");
                setError("");
              }}
              disabled={changingStatus}
              className="text-sm text-[var(--color-muted)] hover:underline disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {paymentStatus === "PENDING" && (
        <div className="pt-3 border-t cut-line space-y-3">
          <p className="text-sm font-bold">تعیین هزینه ارسال و تخصیص کارت</p>

          {itemsNegotiationStatus === "AWAITING_CUSTOMER_REVIEW" && (
            <p className="text-xs text-red-600 font-medium">
              قبل از تعیین هزینه ارسال، مشتری باید تغییرات اقلام سفارش رو تأیید کنه.
            </p>
          )}

          {showExternalShippingNotice && (
            <p className="text-xs text-[var(--color-ochre)] font-medium">
              این سفارش کالای خارجی (ترندیول) داره -- هزینه ارسالش بعد از خرید و وزن‌کشی جداگانه
              تعیین می‌شه. همین الان فقط مبلغ اقلام سفارش تسویه می‌شه.
            </p>
          )}

          {freeShippingApplied && (
            <p className="text-xs text-green-700 font-medium">
              این سفارش کد تخفیف ارسال رایگان داره — هزینه ارسال خودکار صفر در نظر گرفته می‌شه.
            </p>
          )}

          {shippingMethod && !hasExternalItems && (
            <p className="text-xs text-[var(--color-muted)]">
              نحوه ارسال (انتخاب مشتری): <span className="font-bold text-[var(--color-ink)]">{shippingMethod}</span>
            </p>
          )}

          {showNoCostMethodNotice && (
            <p className="text-xs text-green-700 font-medium">
              این سفارش با «{effectiveMethod}» ارسال می‌شه — هزینه‌ش مستقیم توسط مشتری به تحویل‌دهنده
              پرداخت می‌شه، نیازی به وارد کردن هزینه ارسال نیست.
            </p>
          )}

          {showCostInput && (
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-1">هزینه ارسال</p>
              <CurrencyInput
                value={shippingCostInput}
                onChange={setShippingCostInput}
                placeholder="مثلاً 45,000"
                className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm bg-white"
              />
            </div>
          )}

          {showMethodSelect && (
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-1">نحوه ارسال</p>
              <select
                value={shippingMethodInput}
                onChange={(e) => setShippingMethodInput(e.target.value)}
                className="w-full border cut-line rounded-lg px-2 py-1.5 text-sm bg-white"
              >
                <option value="">انتخاب کنید...</option>
                {SHIPPING_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {bankCards.length === 0 ? (
            <p className="text-xs text-red-600">
              هیچ کارت فعالی ثبت نشده — اگه مبلغی باقی بمونه لازمه از{" "}
              <a href="/admin/bank-cards" className="underline">
                کارت‌های بانکی
              </a>{" "}
              یکی اضافه کنید.
            </p>
          ) : (
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-1">
                کارت پرداخت (اگه بعد از کیف‌پول مبلغی باقی بمونه)
              </p>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full border cut-line rounded-lg px-2 py-1.5 text-sm bg-white"
                dir="ltr"
              >
                {bankCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cardNumber} — {c.holderName}
                    {c.label && ` (${c.label})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleFinalize}
            disabled={finalizeDisabled}
            className="bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {finalizing ? "..." : "ثبت و ارسال به مشتری"}
          </button>
        </div>
      )}

      {paymentStatus === "AWAITING_VERIFICATION" && receiptImage && (
        <div className="pt-3 border-t cut-line">
          <p className="text-sm font-bold mb-2">بررسی فیش واریزی</p>
          <div className="flex items-center gap-3 mb-2">
            <a
              href={receiptImage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--color-wine)] hover:underline font-medium"
            >
              📎 مشاهده فیش واریزی
            </a>
            <button
              onClick={() => verifyPayment("approve")}
              disabled={verifying}
              className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              تأیید پرداخت
            </button>
            {!rejectPaymentFormOpen && (
              <button
                onClick={() => setRejectPaymentFormOpen(true)}
                disabled={verifying}
                className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
              >
                رد پرداخت
              </button>
            )}
          </div>

          {rejectPaymentFormOpen && (
            <div className="border cut-line rounded-lg p-3 space-y-2">
              <p className="text-xs text-[var(--color-muted)]">دلیل رد پرداخت (سفارش لغو می‌شود)</p>
              <textarea
                value={rejectPaymentReason}
                onChange={(e) => setRejectPaymentReason(e.target.value)}
                placeholder="دلیل رد پرداخت را بنویسید..."
                rows={2}
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRejectPaymentSubmit}
                  disabled={verifying}
                  className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
                >
                  {verifying ? "..." : "تأیید رد پرداخت"}
                </button>
                <button
                  onClick={() => {
                    setRejectPaymentFormOpen(false);
                    setRejectPaymentReason("");
                    setError("");
                  }}
                  disabled={verifying}
                  className="text-sm text-[var(--color-muted)] hover:underline disabled:opacity-50"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(hasExternalItems || shippingPayment) && paymentStatus === "PAID" && canRetryShippingCost && (
        <div className="pt-3 border-t cut-line space-y-3">
          <p className="text-sm font-bold">تعیین هزینه ارسال نهایی (بعد از وزن‌کشی)</p>
          {priceAdjustmentPreview !== 0 && (
            <p className={`text-xs ${priceAdjustmentPreview > 0 ? "text-red-600" : "text-green-700"}`}>
              اختلاف قیمت خرید اقلام: {priceAdjustmentPreview > 0 ? "+" : ""}
              {priceAdjustmentPreview.toLocaleString("fa-IR")} تومان (به‌صورت خودکار به این تسویه اضافه می‌شود)
            </p>
          )}
          {externalItems && externalItems.length > 0 && (
            <button
              type="button"
              onClick={() => setCargoBreakdownOpen((v) => !v)}
              className="text-xs text-[var(--color-wine)] hover:underline"
            >
              {cargoBreakdownOpen ? "بستن جزئیات به‌تفکیک کالا" : "محاسبه‌ی باربری به‌تفکیک هر کالا (وزن/هزینه)"}
            </button>
          )}
          {cargoBreakdownOpen && externalItems && (
            <div className="border cut-line rounded-lg p-3 space-y-2 bg-[var(--color-linen-dim)]/40">
              <div className="flex items-center gap-2">
                <p className="text-xs text-[var(--color-muted)] whitespace-nowrap">نرخ به ازای هر کیلو (تومان)</p>
                <input
                  type="number"
                  value={cargoRateInput}
                  onChange={(e) => {
                    setCargoRateInput(e.target.value);
                    syncCargoTotal(itemWeights, itemCargoCosts, e.target.value);
                  }}
                  className="w-32 border cut-line rounded-lg px-2 py-1 text-sm bg-white"
                  dir="ltr"
                />
              </div>
              {externalItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{item.title} × {item.quantity}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    // ذخیره‌ی داخلی (itemWeights) همچنان گرمه -- چون فرمولِ هزینه‌ی
                    // باربری و بدنه‌ی درخواستِ ارسالی هم گرم می‌خوان؛ فقط نمایش و
                    // ورودی به کیلوگرم (با اعشار) تبدیل می‌شه
                    value={itemWeights[item.id] ? String(Number(itemWeights[item.id]) / 1000) : ""}
                    onChange={(e) => {
                      const kg = e.target.value;
                      const grams = kg.trim() ? String(Math.round(Number(kg) * 1000)) : "";
                      const next = { ...itemWeights, [item.id]: grams };
                      setItemWeights(next);
                      syncCargoTotal(next, itemCargoCosts, cargoRateInput);
                    }}
                    placeholder="وزن (کیلوگرم)"
                    className="w-24 border cut-line rounded-lg px-2 py-1 bg-white"
                    dir="ltr"
                  />
                  <input
                    type="number"
                    value={itemCargoCosts[item.id] ?? ""}
                    onChange={(e) => {
                      const next = { ...itemCargoCosts, [item.id]: e.target.value };
                      setItemCargoCosts(next);
                      syncCargoTotal(itemWeights, next, cargoRateInput);
                    }}
                    placeholder="هزینه باربری (اختیاری)"
                    className="w-32 border cut-line rounded-lg px-2 py-1 bg-white"
                    dir="ltr"
                  />
                  <span className="text-[var(--color-muted)] whitespace-nowrap w-24 text-left" dir="ltr">
                    {computedItemCargoCost(item.id).toLocaleString("fa-IR")}
                  </span>
                </div>
              ))}
              <p className="text-xs text-[var(--color-muted)]">
                جمع باربری این کالاها به‌صورت خودکار توی فیلد «هزینه باربری» زیر نوشته شد -- در صورت نیاز می‌توانید آن را
                دستی تغییر دهید.
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-1">هزینه باربری (حمل بین‌المللی)</p>
            <CurrencyInput
              value={finalCargoCostInput}
              onChange={setFinalCargoCostInput}
              placeholder="مثلاً 150,000"
              className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm bg-white"
            />
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-1">هزینه ارسال (تحویل داخلی)</p>
            <CurrencyInput
              value={finalShippingCostInput}
              onChange={setFinalShippingCostInput}
              placeholder="مثلاً 45,000"
              className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm bg-white"
            />
          </div>
          {bankCards.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-1">کارت پرداخت</p>
              <select
                value={finalShippingCardId}
                onChange={(e) => setFinalShippingCardId(e.target.value)}
                className="w-full border cut-line rounded-lg px-2 py-1.5 text-sm bg-white"
                dir="ltr"
              >
                {bankCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cardNumber} — {c.holderName}
                    {c.label && ` (${c.label})`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleSetShippingCost}
            disabled={settingShippingCost || !finalShippingCostInput || !finalCargoCostInput}
            className="bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {settingShippingCost ? "..." : "ثبت هزینه ارسال و ارسال به مشتری"}
          </button>
        </div>
      )}

      {shippingPayment?.status === "AWAITING_VERIFICATION" && shippingPayment.receiptImage && (
        <div className="pt-3 border-t cut-line">
          <p className="text-sm font-bold mb-2">بررسی فیش هزینه ارسال (دور دوم)</p>
          <div className="flex items-center gap-3 mb-2">
            <a
              href={shippingPayment.receiptImage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--color-wine)] hover:underline font-medium"
            >
              📎 مشاهده فیش واریزی
            </a>
            <button
              onClick={() => verifyShippingPayment("approve")}
              disabled={verifyingShipping}
              className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              تأیید پرداخت
            </button>
            {!rejectShippingFormOpen && (
              <button
                onClick={() => setRejectShippingFormOpen(true)}
                disabled={verifyingShipping}
                className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
              >
                رد پرداخت
              </button>
            )}
          </div>

          {rejectShippingFormOpen && (
            <div className="border cut-line rounded-lg p-3 space-y-2">
              <p className="text-xs text-[var(--color-muted)]">دلیل رد پرداخت</p>
              <textarea
                value={rejectShippingReason}
                onChange={(e) => setRejectShippingReason(e.target.value)}
                placeholder="دلیل رد پرداخت را بنویسید..."
                rows={2}
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRejectShippingSubmit}
                  disabled={verifyingShipping}
                  className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
                >
                  {verifyingShipping ? "..." : "تأیید رد پرداخت"}
                </button>
                <button
                  onClick={() => {
                    setRejectShippingFormOpen(false);
                    setRejectShippingReason("");
                    setError("");
                  }}
                  disabled={verifyingShipping}
                  className="text-sm text-[var(--color-muted)] hover:underline disabled:opacity-50"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

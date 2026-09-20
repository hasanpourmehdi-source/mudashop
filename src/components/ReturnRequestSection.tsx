"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "کالای معیوب",
  WRONG_ITEM: "ارسال کالای اشتباه",
  WRONG_SIZE: "سایز/مشخصات نامناسب",
  CHANGED_MIND: "انصراف بدون دلیل خاص",
  OTHER: "سایر",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأیید شده — منتظر ارسال کالا",
  REJECTED: "رد شده",
  ITEM_RECEIVED: "کالا دریافت شد",
  REFUNDED: "وجه به کیف پول بازگشت داده شد",
};

type OrderItemInfo = {
  id: string;
  title: string;
  quantity: number;
  price: number;
  isReturnable: boolean;
  source: "MAZON" | "TRENDYOL";
};

type ExistingReturn = {
  status: string;
  refundAmount: number;
  createdAt: string;
  items: { orderItemId: string; reason: string; description: string | null }[];
} | null;

type ItemSelection = { checked: boolean; reason: string; description: string };

export function ReturnRequestSection({
  orderId,
  orderItems,
  isDelivered,
  withinReturnWindow,
  existingReturn,
  returnWindowDays,
  selfServiceEnabled,
}: {
  orderId: string;
  orderItems: OrderItemInfo[];
  isDelivered: boolean;
  withinReturnWindow: boolean;
  existingReturn: ExistingReturn;
  returnWindowDays: number;
  // وقتی ادمین این رو خاموش کرده باشه، به‌جای دکمه/فرمِ ثبتِ درخواستِ *تازه*،
  // پیامِ تماس‌با‌پشتیبانی نشون داده می‌شه -- ولی وضعیتِ یه درخواستِ از قبل
  // ثبت‌شده (بالاتر) همچنان دیده می‌شه، چون اون فقط نمایشه، نه ثبتِ تازه
  selfServiceEnabled: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selections, setSelections] = useState<Record<string, ItemSelection>>(
    Object.fromEntries(orderItems.map((i) => [i.id, { checked: false, reason: "DEFECTIVE", description: "" }]))
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateSelection(itemId: string, patch: Partial<ItemSelection>) {
    setSelections((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  async function handleSubmit() {
    const items = Object.entries(selections)
      .filter(([, sel]) => sel.checked)
      .map(([orderItemId, sel]) => ({
        orderItemId,
        reason: sel.reason,
        description: sel.description || undefined,
      }));
    if (items.length === 0) {
      setError("حداقل یک کالا را برای مرجوع کردن انتخاب کنید");
      return;
    }
    setError("");
    setSubmitting(true);
    const res = await fetch(`/api/orders/${orderId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ثبت درخواست");
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  // درخواست رد‌شده تنها حالتیه که مشتری هنوز می‌تونه (تا مهلت مهلتش تموم نشده)
  // یه درخواست جدید ثبت کنه -- بقیه‌ی حالت‌ها (در انتظار/تأیید/دریافت‌شده/بازگشت)
  // درخواست فعلاً در جریانه، پس فقط نمایش می‌دیم
  if (existingReturn && existingReturn.status !== "REJECTED") {
    const titleById = new Map(orderItems.map((i) => [i.id, i.title]));
    return (
      <section className="mb-8 border cut-line rounded-lg p-4 bg-white">
        <h2 className="font-bold mb-2 text-sm">درخواست مرجوعی</h2>
        <div className="space-y-2 mb-2">
          {existingReturn.items.map((item) => (
            <div key={item.orderItemId} className="text-sm border-b cut-line pb-2 last:border-0 last:pb-0">
              <p className="font-medium">{titleById.get(item.orderItemId) ?? "کالا"}</p>
              <p className="text-[var(--color-muted)] text-xs">
                دلیل: {REASON_LABELS[item.reason] ?? item.reason}
              </p>
              {item.description && (
                <p className="text-[var(--color-muted)] text-xs">«{item.description}»</p>
              )}
            </div>
          ))}
        </div>
        <p className="text-sm font-medium">
          وضعیت:{" "}
          <span className="text-[var(--color-wine)]">
            {STATUS_LABELS[existingReturn.status] ?? existingReturn.status}
          </span>
        </p>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          مبلغ قابل بازگشت: {existingReturn.refundAmount.toLocaleString("fa-IR")} تومان
        </p>
      </section>
    );
  }

  const rejectedInfo = existingReturn?.status === "REJECTED" ? existingReturn : null;

  // قبل از تحویل، مهلت هنوز شروع نشده -- نه فقط "گذشته نیست"، بلکه اصلاً
  // معنی نداره؛ فقط بعد از تحویل واقعاً می‌شه گفت مهلتش گذشته یا نه
  if (!isDelivered) return null;

  if (!selfServiceEnabled) {
    return (
      <div className="mb-8">
        <p className="text-xs text-[var(--color-muted)]">
          برای مرجوعیِ این سفارش، لطفاً با پشتیبانی تماس بگیرید.
        </p>
      </div>
    );
  }

  if (!withinReturnWindow) {
    return (
      <div className="mb-8 space-y-2">
        {rejectedInfo && (
          <p className="text-xs text-red-600">
            درخواست مرجوعی قبلی‌تان رد شده بود.
          </p>
        )}
        <p className="text-xs text-[var(--color-muted)]">
          مهلت {returnWindowDays.toLocaleString("fa-IR")} روزه‌ی درخواست مرجوعی این سفارش گذشته است.
        </p>
      </div>
    );
  }

  return (
    <section className="mb-8">
      {rejectedInfo && !showForm && (
        <p className="text-xs text-red-600 mb-2">
          درخواست مرجوعی قبلی‌تان رد شده بود؛ می‌توانید دوباره درخواست بدهید.
        </p>
      )}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="text-sm border cut-line px-4 py-2 rounded-full bg-white hover:border-[var(--color-wine)]"
        >
          {rejectedInfo ? "ثبت درخواست مرجوعی جدید" : "درخواست مرجوعی"}
        </button>
      ) : (
        <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
          <h2 className="font-bold text-sm">ثبت درخواست مرجوعی</h2>
          <p className="text-xs text-[var(--color-muted)]">
            کالاهایی که می‌خوای مرجوع کنی رو انتخاب کن؛ برای هرکدوم می‌تونی دلیل جدا بدی.
          </p>
          <div className="space-y-3">
            {orderItems.map((item) => {
              const sel = selections[item.id];
              return (
                <div key={item.id} className="border cut-line rounded-lg p-3">
                  <label
                    className={`flex items-center gap-2 text-sm font-medium ${
                      item.isReturnable ? "" : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sel.checked}
                      disabled={!item.isReturnable}
                      onChange={(e) => updateSelection(item.id, { checked: e.target.checked })}
                    />
                    {item.title} × {item.quantity}
                  </label>
                  {!item.isReturnable && (
                    <p className="text-[11px] text-red-600 mt-1 pr-6">این کالا قابل مرجوع نیست.</p>
                  )}
                  {item.source === "TRENDYOL" && (
                    <p className="text-[11px] text-[var(--color-muted)] mt-1 pr-6">
                      کالای خارجی فقط در صورتِ خرابی، ارسالِ اشتباه یا نامناسب‌بودنِ سایز/رنگ قابلِ مرجوعه.
                    </p>
                  )}
                  {sel.checked && (
                    <div className="mt-2 space-y-2 pr-6">
                      <select
                        value={sel.reason}
                        onChange={(e) => updateSelection(item.id, { reason: e.target.value })}
                        className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {Object.entries(REASON_LABELS)
                          .filter(([value]) => !(item.source === "TRENDYOL" && value === "CHANGED_MIND"))
                          .map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                      </select>
                      <textarea
                        value={sel.description}
                        onChange={(e) => updateSelection(item.id, { description: e.target.value })}
                        className="w-full border cut-line rounded-lg px-3 py-2 text-sm min-h-16"
                        placeholder="توضیح تکمیلی (اختیاری)..."
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "در حال ثبت..." : "ثبت درخواست"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-[var(--color-muted)]"
            >
              انصراف
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

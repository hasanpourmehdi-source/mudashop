"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyInput } from "@/components/CurrencyInput";

type OrderItemRow = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  source: "MAZON" | "TRENDYOL";
};

// ویرایش اقلام سفارش (تعداد/قیمت/حذف) -- فقط تا وقتی سفارش منتظر تأیید
// ادمینه (paymentStatus === "PENDING")، چون بعد از اون موجودی/جمع‌کل قفل می‌شه.
// افزودن قلم جدید از اینجا انجام نمی‌شه -- ادمین از خودِ صفحه‌ی محصول (دکمه‌ی
// «افزودن به سفارش...») این کار رو می‌کنه، چون همون‌جا سایز/رنگ/تعداد واقعی
// محصول مشخصه
export function AdminOrderItemsEditor({
  orderId,
  items,
  itemsNegotiationStatus,
}: {
  orderId: string;
  items: OrderItemRow[];
  itemsNegotiationStatus: string;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, { quantity: string; price: string; reason: string }>>(
    Object.fromEntries(
      items.map((i) => [i.id, { quantity: String(i.quantity), price: String(i.price), reason: "" }])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function updateDraft(id: string, field: "quantity" | "price" | "reason", value: string) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleSaveItem(id: string) {
    setError("");
    setSavingId(id);
    const draft = drafts[id];
    const res = await fetch(`/api/admin/orders/${orderId}/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: Number(draft.quantity || 0),
        price: Number(draft.price || 0),
        reason: draft.reason.trim() || undefined,
      }),
    });
    setSavingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ویرایش قلم");
      return;
    }
    router.refresh();
  }

  async function handleRemoveItem(id: string) {
    if (!confirm("این قلم از سفارش حذف بشه؟")) return;
    setError("");
    setSavingId(id);
    const reason = drafts[id]?.reason.trim();
    const res = await fetch(`/api/admin/orders/${orderId}/items/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || undefined }),
    });
    setSavingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در حذف قلم");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mb-8 space-y-2">
      <h2 className="font-bold mb-2 text-sm">اقلام سفارش (قابل ویرایش تا قبل از تعیین هزینه ارسال)</h2>

      {itemsNegotiationStatus === "AWAITING_ADMIN_REVIEW" && (
        <p className="text-xs text-[var(--color-ochre)] font-medium bg-[var(--color-ochre)]/10 rounded-lg px-3 py-2">
          مشتری روی این اقلام تغییراتی اعمال کرد -- لطفاً بررسی کنید.
        </p>
      )}
      {itemsNegotiationStatus === "AWAITING_CUSTOMER_REVIEW" && (
        <p className="text-xs text-[var(--color-muted)] bg-[var(--color-linen-dim)] rounded-lg px-3 py-2">
          منتظر بررسی و پاسخ مشتری روی این تغییرات هستیم. (همچنان می‌تونید دوباره ویرایش کنید.)
        </p>
      )}

      {items.map((item) => {
        const draft = drafts[item.id] ?? { quantity: String(item.quantity), price: String(item.price), reason: "" };
        return (
          <div key={item.id} className="border cut-line rounded-lg p-3 bg-white text-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {item.title}
                {item.source === "TRENDYOL" && (
                  <span className="text-[10px] text-[var(--color-muted)] mr-1">(ترندیول)</span>
                )}
              </span>
              <button
                onClick={() => handleRemoveItem(item.id)}
                disabled={savingId === item.id}
                className="text-xs text-red-600 disabled:opacity-50"
              >
                حذف
              </button>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <span className="text-[10px] text-[var(--color-muted)] block mb-0.5">تعداد</span>
                <input
                  type="number"
                  min={1}
                  value={draft.quantity}
                  onChange={(e) => updateDraft(item.id, "quantity", e.target.value)}
                  className="w-20 border cut-line rounded-lg px-2 py-1 text-sm"
                />
              </div>
              <div className="flex-1">
                <span className="text-[10px] text-[var(--color-muted)] block mb-0.5">قیمت واحد</span>
                <CurrencyInput
                  value={draft.price}
                  onChange={(v) => updateDraft(item.id, "price", v)}
                  className="w-full border cut-line rounded-lg px-2 py-1 text-sm"
                />
              </div>
              <button
                onClick={() => handleSaveItem(item.id)}
                disabled={savingId === item.id}
                className="bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
              >
                ذخیره
              </button>
            </div>
            <div>
              <span className="text-[10px] text-[var(--color-muted)] block mb-0.5">
                دلیل این تغییر (اختیاری -- به مشتری نشون داده می‌شه، مثلاً «ناموجود شد، این مورد مشابه رو پیشنهاد می‌کنیم»)
              </span>
              <textarea
                value={draft.reason}
                onChange={(e) => updateDraft(item.id, "reason", e.target.value)}
                rows={2}
                className="w-full border cut-line rounded-lg px-2 py-1.5 text-xs"
                placeholder="مثلاً: این کالا دیگه موجود نیست، این مورد مشابه رو پیشنهاد می‌کنیم"
              />
            </div>
          </div>
        );
      })}

      <p className="text-xs text-[var(--color-muted)]">
        برای افزودن قلم جدید، از صفحه‌ی همون محصول استفاده کنید (دکمه‌ی «افزودن به سفارش...»).
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}

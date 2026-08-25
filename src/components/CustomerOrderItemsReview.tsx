"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrderItemRow = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  source: "MAZON" | "TRENDYOL";
  url?: string;
  variantLabel?: string;
};

// وقتی ادمین اقلام سفارش رو ویرایش کرده (itemsNegotiationStatus !== "AGREED")،
// این کامپوننت به‌جای نمایش ساده‌ی فعلی نشون داده می‌شه: مشتری یا بدون تغییر
// تأیید می‌کنه، یا خودش تعداد/حذف اقلام رو تغییر می‌ده -- که در اون صورت نوبت
// دوباره برمی‌گرده به ادمین
export function CustomerOrderItemsReview({
  orderId,
  items,
  itemsNegotiationStatus,
}: {
  orderId: string;
  items: OrderItemRow[];
  itemsNegotiationStatus: string;
}) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, String(i.quantity)]))
  );
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<"confirm" | "respond" | null>(null);
  const [error, setError] = useState("");

  const isCustomerTurn = itemsNegotiationStatus === "AWAITING_CUSTOMER_REVIEW";

  async function handleConfirm() {
    setError("");
    setSubmitting("confirm");
    const res = await fetch(`/api/orders/${orderId}/confirm-items`, { method: "POST" });
    setSubmitting(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت تأیید");
      return;
    }
    router.refresh();
  }

  async function handleRespond() {
    setError("");
    setSubmitting("respond");
    const changedItems = items
      .filter((i) => !removed[i.id] && Number(quantities[i.id]) !== i.quantity)
      .map((i) => ({ id: i.id, quantity: Number(quantities[i.id]) }));
    const removedItemIds = items.filter((i) => removed[i.id]).map((i) => i.id);

    const res = await fetch(`/api/orders/${orderId}/items/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: changedItems, removedItemIds }),
    });
    setSubmitting(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت تغییرات");
      return;
    }
    router.refresh();
  }

  const hasAnyChange =
    Object.values(removed).some(Boolean) ||
    items.some((i) => !removed[i.id] && Number(quantities[i.id] || 0) !== i.quantity);

  return (
    <section className="mb-8 space-y-2">
      <h2 className="font-bold mb-2 text-sm">اقلام سفارش</h2>

      {isCustomerTurn ? (
        <p className="text-xs text-[var(--color-ochre)] font-medium bg-[var(--color-ochre)]/10 rounded-lg px-3 py-2">
          ادمین اقلام این سفارش رو ویرایش کرد. لطفاً بررسی کنید و یا تأیید کنید یا تغییرات مدنظرتون رو اعمال کنید.
        </p>
      ) : (
        <p className="text-xs text-[var(--color-muted)] bg-[var(--color-linen-dim)] rounded-lg px-3 py-2">
          تغییرات شما برای ادمین ارسال شد -- منتظر بررسی ادمین هستیم.
        </p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className={`border cut-line rounded-lg p-3 bg-white text-sm space-y-2 ${
            removed[item.id] ? "opacity-40" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {item.url ? (
                <a
                  href={item.url}
                  target={item.url.startsWith("http") ? "_blank" : undefined}
                  rel={item.url.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="text-[var(--color-wine)] hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                item.title
              )}
              {item.source === "TRENDYOL" && (
                <span className="text-[10px] text-[var(--color-muted)] mr-1">(ترندیول)</span>
              )}
              {item.variantLabel && (
                <span className="text-xs text-[var(--color-muted)] mr-1">({item.variantLabel})</span>
              )}
            </span>
            {isCustomerTurn && (
              <button
                type="button"
                onClick={() => setRemoved((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                className={`text-xs ${removed[item.id] ? "text-[var(--color-wine)]" : "text-red-600"}`}
              >
                {removed[item.id] ? "بازگردانی" : "حذف"}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            {isCustomerTurn && !removed[item.id] ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--color-muted)]">تعداد</span>
                <input
                  type="number"
                  min={1}
                  value={quantities[item.id]}
                  onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  className="w-16 border cut-line rounded-lg px-2 py-1 text-sm"
                />
              </div>
            ) : (
              <span className="text-[var(--color-muted)]">تعداد: {item.quantity}</span>
            )}
            <span className="font-medium">
              {(item.price * item.quantity).toLocaleString("fa-IR")} تومان
            </span>
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {isCustomerTurn && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleConfirm}
            disabled={submitting !== null}
            className="bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {submitting === "confirm" ? "..." : "تأیید بدون تغییر"}
          </button>
          <button
            onClick={handleRespond}
            disabled={submitting !== null || !hasAnyChange}
            className="border cut-line px-4 py-1.5 rounded-full text-sm font-medium bg-white disabled:opacity-50"
          >
            {submitting === "respond" ? "..." : "ثبت تغییرات من"}
          </button>
        </div>
      )}
    </section>
  );
}

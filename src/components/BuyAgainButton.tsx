"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { Spinner } from "@/components/Spinner";
import { useSalesPaused } from "@/components/SalesPausedProvider";

// «خرید مجدد سریع» -- اقلام مزونِ سفارش قبلی را با قیمت/موجودی فعلی به سبد
// اضافه می‌کند و می‌فرستد به سبد. اقلام ناموجود/حذف‌شده گزارش می‌شوند.
export function BuyAgainButton({ orderId }: { orderId: string }) {
  const { addItem } = useCart();
  const { paused: salesPaused } = useSalesPaused();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (salesPaused) return null;

  async function handleClick() {
    setBusy(true);
    setFeedback("");
    try {
      const res = await fetch("/api/orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback(data.error ?? "خطا در خرید مجدد");
        setBusy(false);
        return;
      }
      const cartItems: unknown[] = Array.isArray(data.cartItems) ? data.cartItems : [];
      for (const item of cartItems) addItem(item as Parameters<typeof addItem>[0]);

      const skippedCount = Array.isArray(data.skipped) ? data.skipped.length : 0;
      if (cartItems.length === 0) {
        setFeedback(skippedCount > 0 ? "همه‌ی اقلام دیگر موجود نیستند" : "چیزی برای افزودن نیست");
        setBusy(false);
        return;
      }
      router.push("/cart");
    } catch {
      setFeedback("خطا در اتصال به سرور");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-xs font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {busy && <Spinner className="w-3.5 h-3.5" />}
        {busy ? "در حال افزودن..." : "دوباره بخر"}
      </button>
      {feedback && <span className="text-[11px] text-[var(--color-ochre)]">{feedback}</span>}
    </span>
  );
}
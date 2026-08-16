"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MismatchItem = {
  id: string;
  title: string;
  purchaseNote: string | null;
  mismatchLabel: string;
};

// وقتی ادمین موقع رسیدنِ یه قلمِ خارجی مغایرت (سایز/رنگ اشتباه) پیدا می‌کنه،
// به‌جای رفاندِ فوریِ خودکار منتظر تصمیم خودِ مشتری می‌مونیم -- این باکس
// دقیقاً همون تصمیم رو می‌گیره
function MismatchCard({ orderId, item }: { orderId: string; item: MismatchItem }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"KEEP" | "REFUND" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "KEEP" | "REFUND") {
    setError("");
    setLoading(decision);
    const res = await fetch(`/api/orders/${orderId}/items/${item.id}/mismatch-decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت تصمیم");
      return;
    }
    router.refresh();
  }

  return (
    <div className="border cut-line rounded-lg p-4 bg-white">
      <p className="text-sm font-medium">{item.title}</p>
      <p className="text-xs text-[var(--color-ochre)] mt-1">مغایرت: {item.mismatchLabel}</p>
      {item.purchaseNote && (
        <p className="text-xs text-[var(--color-muted)] mt-1">«{item.purchaseNote}»</p>
      )}
      <p className="text-xs text-[var(--color-muted)] mt-2">
        این کالا با مغایرت بالا به دست ما رسیده. می‌خوای با همین مورد راضی باشی (بدون تغییری در پرداختت) یا ترجیح می‌دی وجهش به کیف پولت برگردونیم؟
      </p>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => decide("KEEP")}
          disabled={loading !== null}
          className="bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
        >
          {loading === "KEEP" ? "..." : "با همین مورد راضی‌ام"}
        </button>
        <button
          onClick={() => decide("REFUND")}
          disabled={loading !== null}
          className="border cut-line px-3 py-1.5 rounded-full text-xs font-medium text-red-600 disabled:opacity-50"
        >
          {loading === "REFUND" ? "..." : "نه، پول برگردون"}
        </button>
      </div>
    </div>
  );
}

export function ItemMismatchDecision({ orderId, items }: { orderId: string; items: MismatchItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="font-bold mb-2 text-sm">تصمیم درباره‌ی مغایرت اقلام سفارش</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <MismatchCard key={item.id} orderId={orderId} item={item} />
        ))}
      </div>
    </section>
  );
}

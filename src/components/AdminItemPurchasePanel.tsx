"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyInput } from "@/components/CurrencyInput";

type PurchaseItem = {
  id: string;
  title: string;
  quantity: number;
  price: number;
  purchaseStatus: string;
  purchaseTag: string | null;
  purchaseNote: string | null;
  purchasePriceActual: number | null;
  url: string | null; // لینک صفحه‌ی اصلی محصول روی ترندیول -- برای خرید واقعی لازمه
  itemWeightGrams: number | null;
  itemCargoCost: number | null;
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "منتظر خرید", className: "bg-[var(--color-linen-dim)] text-[var(--color-muted)]" },
  PURCHASED: { label: "خریداری شد -- منتظر رسیدن", className: "bg-[var(--color-ochre)]/15 text-[var(--color-ochre)]" },
  RECEIVED: { label: "رسید", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "کنسل شد", className: "bg-red-100 text-red-700" },
  LOST: { label: "گم شد", className: "bg-red-100 text-red-700" },
  WRONG_SIZE: { label: "سایز اشتباه", className: "bg-red-100 text-red-700" },
  WRONG_COLOR: { label: "رنگ اشتباه", className: "bg-red-100 text-red-700" },
  ISSUE_OTHER: { label: "مشکل دیگر", className: "bg-red-100 text-red-700" },
  AWAITING_CUSTOMER_DECISION: { label: "منتظر تصمیم مشتری", className: "bg-[var(--color-ochre)]/15 text-[var(--color-ochre)]" },
};

const RESOLVE_OPTIONS = [
  { value: "RECEIVED", label: "رسید" },
  { value: "LOST", label: "گم شد" },
  { value: "WRONG_SIZE", label: "سایز اشتباه ارسال شد" },
  { value: "WRONG_COLOR", label: "رنگ اشتباه ارسال شد" },
  { value: "ISSUE_OTHER", label: "دلیل دلخواه" },
];

function PurchaseForm({ orderId, item }: { orderId: string; item: PurchaseItem }) {
  const router = useRouter();
  const [tag, setTag] = useState("");
  const [actualPrice, setActualPrice] = useState(String(item.price));
  const [cancelReason, setCancelReason] = useState("");
  const [mode, setMode] = useState<"purchase" | "cancel" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitPurchase() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/admin/orders/${orderId}/items/${item.id}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: tag.trim(), actualPrice: Number(actualPrice || 0) }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت خرید");
      return;
    }
    router.refresh();
  }

  async function submitCancel() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/admin/orders/${orderId}/items/${item.id}/cancel-purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت کنسلی");
      return;
    }
    router.refresh();
  }

  if (mode === "purchase") {
    return (
      <div className="space-y-2 mt-2">
        <div>
          <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">تگ (برای ردیابی فیزیکی)</label>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="w-full border cut-line rounded-lg px-2 py-1 text-sm"
            placeholder="مثلاً یه کد یا شماره‌ی دلخواه"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">قیمت واقعی خریداری‌شده</label>
          <CurrencyInput value={actualPrice} onChange={setActualPrice} className="w-full border cut-line rounded-lg px-2 py-1 text-sm" />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={submitPurchase}
            disabled={loading || !tag.trim()}
            className="bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
          >
            {loading ? "..." : "تأیید خرید"}
          </button>
          <button onClick={() => setMode(null)} className="text-xs text-[var(--color-muted)]">
            انصراف
          </button>
        </div>
      </div>
    );
  }

  if (mode === "cancel") {
    return (
      <div className="space-y-2 mt-2">
        <div>
          <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">دلیل عدم خرید</label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            className="w-full border cut-line rounded-lg px-2 py-1.5 text-xs"
            placeholder="مثلاً: کالا ناموجود شد"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={submitCancel}
            disabled={loading || !cancelReason.trim()}
            className="bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
          >
            {loading ? "..." : "تأیید کنسلی (رفاند فوری)"}
          </button>
          <button onClick={() => setMode(null)} className="text-xs text-[var(--color-muted)]">
            انصراف
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={() => setMode("purchase")}
        className="border cut-line px-3 py-1.5 rounded-full text-xs font-medium hover:border-[var(--color-wine)]"
      >
        خریداری شد
      </button>
      <button onClick={() => setMode("cancel")} className="text-xs text-red-600">
        نشد بخرم
      </button>
    </div>
  );
}

function ResolveForm({ orderId, item }: { orderId: string; item: PurchaseItem }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState("RECEIVED");
  const [note, setNote] = useState("");
  const [weightGrams, setWeightGrams] = useState(item.itemWeightGrams != null ? String(item.itemWeightGrams) : "");
  const [cargoCost, setCargoCost] = useState(item.itemCargoCost != null ? String(item.itemCargoCost) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/admin/orders/${orderId}/items/${item.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outcome,
        note: note.trim() || undefined,
        weightGrams: weightGrams.trim() ? Number(weightGrams) : undefined,
        cargoCost: cargoCost.trim() ? Number(cargoCost) : undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبت نتیجه");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2 mt-2">
      <p className="text-[10px] text-[var(--color-muted)]">وقتی کالا فیزیکی به انبار/نمایندگی رسید، نتیجه رو این‌جا ثبت کن.</p>
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        className="w-full border cut-line rounded-lg px-2 py-1 text-sm bg-white"
      >
        {RESOLVE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {outcome !== "RECEIVED" && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full border cut-line rounded-lg px-2 py-1.5 text-xs"
          placeholder="توضیح تکمیلی (اختیاری)"
        />
      )}
      {/* اختیاری -- اگه همین لحظه (روی برچسب/فاکتور شرکت باربری) وزن و
          هزینه‌ی باربری این قلم رو داری، همین‌جا ثبتش کن؛ بعداً توی فرم
          «تعیین هزینه ارسال» به‌عنوان مقدار پیش‌فرض همین قلم می‌آد -- نیازی
          نیست دوباره تایپش کنی */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">وزن (گرم)</label>
          <input
            type="number"
            value={weightGrams}
            onChange={(e) => setWeightGrams(e.target.value)}
            className="w-full border cut-line rounded-lg px-2 py-1 text-sm"
            placeholder="اختیاری"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">هزینه باربری این قلم</label>
          <CurrencyInput value={cargoCost} onChange={setCargoCost} className="w-full border cut-line rounded-lg px-2 py-1 text-sm" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        className="bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
      >
        {loading ? "..." : "ثبت نتیجه"}
      </button>
    </div>
  );
}

// پیگیری خرید تک‌به‌تک اقلام خارجی، بعد از پرداخت اقلام («در صف خرید») --
// فقط اقلام TRENDYOL نشون داده می‌شن؛ برای مزون این فاز بی‌معنیه
export function AdminItemPurchasePanel({ orderId, items }: { orderId: string; items: PurchaseItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8 border cut-line rounded-lg p-4 bg-white">
      <h2 className="font-bold text-sm mb-3">پیگیری خرید اقلام خارجی</h2>
      <div className="space-y-3">
        {items.map((item) => {
          const badge = STATUS_BADGE[item.purchaseStatus] ?? STATUS_BADGE.PENDING;
          return (
            <div key={item.id} id={`item-${item.id}`} className="border-b cut-line pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {item.title} × {item.quantity}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              {/* برای خرید واقعی، ادمین باید بتونه مستقیم به صفحه‌ی محصول
                  روی ترندیول بره -- این لینک از کش آدرس محصول درمیاد (همون‌جایی
                  که با هر بازدید از صفحه‌ی محصول/نگاه‌سریع پر می‌شه)، پس ممکنه
                  برای اقلامی که هیچ‌وقت این‌جوری دیده نشدن (نادر) در دسترس نباشه */}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-wine)] hover:underline mt-1"
                >
                  🔗 مشاهده/خرید از ترندیول
                </a>
              ) : (
                item.purchaseStatus === "PENDING" && (
                  <p className="text-[10px] text-[var(--color-muted)] mt-1">
                    لینک محصول در دسترس نیست -- برای پیداکردنش می‌تونی از روی عنوان جست‌وجو کنی.
                  </p>
                )
              )}

              {item.purchaseTag && (
                <p className="text-[10px] text-[var(--color-muted)] mt-1" dir="ltr">
                  تگ: {item.purchaseTag}
                  {item.purchasePriceActual != null &&
                    ` — قیمت واقعی: ${item.purchasePriceActual.toLocaleString("fa-IR")} تومان`}
                </p>
              )}
              {item.purchaseNote && <p className="text-[10px] text-[var(--color-muted)] mt-0.5">«{item.purchaseNote}»</p>}

              {item.purchaseStatus === "PENDING" && <PurchaseForm orderId={orderId} item={item} />}
              {item.purchaseStatus === "PURCHASED" && <ResolveForm orderId={orderId} item={item} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

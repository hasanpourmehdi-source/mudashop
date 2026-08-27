"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  createdAt: string;
  user: { name: string | null; email: string };
  items: { id: string; title: string; quantity: number; purchaseTag: string | null }[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پردازش",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  PENDING: "bg-[var(--color-ochre)]/20 text-[var(--color-ochre)]",
  AWAITING_PAYMENT: "bg-[var(--color-ochre)]/20 text-[var(--color-ochre)]",
  AWAITING_VERIFICATION: "bg-[var(--color-ochre)]/20 text-[var(--color-ochre)]",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "پرداخت‌شده",
  FAILED: "پرداخت ناموفق",
  PENDING: "نیاز به تخصیص کارت",
  AWAITING_PAYMENT: "منتظر پرداخت مشتری",
  AWAITING_VERIFICATION: "در انتظار تأیید فیش",
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagQuery, setTagQuery] = useState("");
  const [tagSearching, setTagSearching] = useState(false);
  const [tagError, setTagError] = useState("");

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((res) => (res.ok ? res.json() : []))
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  // جست‌وجو با تگِ فیزیکیِ یه قلم خارجی (فاز پیگیری خرید) -- چون این تگ یکتاست،
  // نتیجه حداکثر یه سفارشه؛ مستقیم همون سفارش (با انکر روی همون قلم) باز می‌شه
  async function handleTagSearch() {
    const tag = tagQuery.trim();
    if (!tag) return;
    setTagError("");
    setTagSearching(true);
    const res = await fetch(`/api/admin/orders?tag=${encodeURIComponent(tag)}`);
    const data: Order[] = res.ok ? await res.json() : [];
    setTagSearching(false);
    const match = data[0];
    if (!match) {
      setTagError("هیچ قلمی با این تگ پیدا نشد");
      return;
    }
    const item = match.items.find((i) => i.purchaseTag === tag);
    router.push(item ? `/admin/orders/${match.id}#item-${item.id}` : `/admin/orders/${match.id}`);
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">سفارش‌ها ({orders.length})</h1>

      <div className="mb-6 border cut-line rounded-lg p-3 bg-white flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium block mb-1">جست‌وجو با تگ کالا</label>
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTagSearch()}
            placeholder="تگی که موقع خرید کالا وارد شده رو بزن یا اسکن کن"
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
          />
          {tagError && <p className="text-xs text-red-600 mt-1">{tagError}</p>}
        </div>
        <button
          onClick={handleTagSearch}
          disabled={tagSearching || !tagQuery.trim()}
          className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {tagSearching ? "..." : "پیدا کن"}
        </button>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/admin/orders/${order.id}`}
            className="block border cut-line rounded-lg p-4 bg-white text-sm hover:border-[var(--color-wine)] transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">#{order.id.slice(-8)}</span>
              <div className="flex items-center gap-2">
                {order.paymentMethod === "CASH_ON_DELIVERY" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    پرداخت در محل
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    PAYMENT_STATUS_STYLES[order.paymentStatus] ?? PAYMENT_STATUS_STYLES.PENDING
                  }`}
                >
                  {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    order.status === "CANCELLED"
                      ? "bg-red-100 text-red-700"
                      : "bg-[var(--color-linen-dim)] text-[var(--color-ink)]"
                  }`}
                >
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
            </div>
            <p className="text-[var(--color-muted)] text-xs mb-1">
              {order.user.name ?? order.user.email} · {order.items.length} قلم ·{" "}
              {new Date(order.createdAt).toLocaleDateString("fa-IR")}
            </p>
            <p className="font-bold text-[var(--color-wine)]">
              {order.total.toLocaleString("fa-IR")} تومان
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

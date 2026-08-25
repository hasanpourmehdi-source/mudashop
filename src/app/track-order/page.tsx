"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OrderTracking, type OrderTrackingData } from "@/components/OrderTracking";

type TrackedOrder = Omit<OrderTrackingData, "items"> & {
  total: number;
  trackingCode: string | null;
  items: {
    source: string;
    purchaseStatus: string;
    quantity: number;
    title: string;
    price: number;
    image: string | null;
    variantLabel: string | null;
  }[];
};

// پیگیریِ سفارشِ «خریدِ مهمان» بدون لاگین -- فقط با شناسه‌ی سفارش + همون ایمیلی
// که موقع خرید داده شده. مشتری‌های لاگین‌کرده سفارش‌هاشون رو از /orders می‌بینن؛
// این صفحه فقط برای کسی‌ه که حساب کاربری نداره
function TrackOrderForm() {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get("orderId") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (id: string, mail: string) => {
    if (!id.trim() || !mail.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/orders/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id.trim(), email: mail.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "سفارشی پیدا نشد");
      setOrder(null);
      return;
    }
    setOrder(data);
  }, []);

  useEffect(() => {
    const initialId = searchParams.get("orderId");
    const initialEmail = searchParams.get("email");
    if (initialId && initialEmail) lookup(initialId, initialEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">📦 پیگیری سفارش</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          اگه بدون ثبت‌نام خرید کردی، با شناسه‌ی سفارش و همون ایمیلی که موقع خرید
          داده بودی، وضعیت سفارشت رو ببین.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(orderId, email);
        }}
        noValidate
        className="border cut-line rounded-xl p-5 bg-white space-y-3"
      >
        <input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="شناسه سفارش"
          dir="ltr"
          required
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ایمیلی که موقع خرید وارد کردی"
          dir="ltr"
          required
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {loading ? "..." : "پیگیری سفارش"}
        </button>
      </form>

      {order && (
        <div className="space-y-4">
          <OrderTracking initialOrder={order} disablePolling />
          <div className="border cut-line rounded-xl p-5 bg-white space-y-2">
            <h2 className="font-bold text-sm">اقلام سفارش</h2>
            <ul className="text-sm divide-y divide-[var(--color-linen-dim)]">
              {order.items.map((item, idx) => (
                <li key={idx} className="py-2 flex justify-between gap-3">
                  <span>
                    {item.title}
                    {item.variantLabel && (
                      <span className="text-xs text-[var(--color-muted)]"> ({item.variantLabel})</span>
                    )}
                    {" × "}
                    {item.quantity.toLocaleString("fa-IR")}
                  </span>
                  <span className="font-medium">{(item.price * item.quantity).toLocaleString("fa-IR")} تومان</span>
                </li>
              ))}
            </ul>
            <p className="text-sm font-bold pt-2 border-t cut-line">
              جمع کل: {order.total.toLocaleString("fa-IR")} تومان
            </p>
            {order.trackingCode && (
              <p className="text-sm text-[var(--color-muted)]">کد رهگیری: {order.trackingCode}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={null}>
      <TrackOrderForm />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

type OrderOption = {
  id: string;
  total: number;
  user: { name: string | null; email: string };
  items: { title: string; quantity: number }[];
};

// دکمه‌ی مخصوص ادمین که مستقیم روی صفحه‌ی محصول (مزون یا ترندیول) نشون داده
// می‌شه -- ترکیب انتخابی (سایز/رنگ/تعداد) همین‌جا با یه کلیک به یه سفارشِ در
// انتظار تأیید اضافه می‌شه، بدون نیاز به فرم جدای دستی توی صفحه‌ی سفارش
export function AdminAddToOrderButton({
  source,
  productId,
  externalId,
  variantId,
  title,
  image,
  price,
  quantity,
  disabled,
}: {
  source: "MAZON" | "TRENDYOL";
  productId?: string;
  externalId?: string;
  variantId?: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
  disabled?: boolean;
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (session?.user?.role !== "ADMIN") return null;

  async function search(q: string) {
    setQuery(q);
    setLoading(true);
    const res = await fetch(
      `/api/admin/orders?paymentStatus=PENDING${q ? `&q=${encodeURIComponent(q)}` : ""}`
    );
    const data = await res.json().catch(() => []);
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function openPanel() {
    setOpen(true);
    setMessage("");
    setError("");
    search("");
  }

  async function handleAdd(orderId: string) {
    setSubmittingId(orderId);
    setError("");
    const body =
      source === "MAZON"
        ? { source: "MAZON", productId, variantId, quantity }
        : { source: "TRENDYOL", externalId, title, image, price, quantity };
    const res = await fetch(`/api/admin/orders/${orderId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmittingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در افزودن به سفارش");
      return;
    }
    setMessage(`به سفارش #${orderId.slice(-8)} اضافه شد ✓`);
    setTimeout(() => setOpen(false), 1500);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        disabled={disabled}
        className="w-full border-2 border-dashed border-[var(--color-ochre)] text-[var(--color-ochre)] py-2 rounded-full text-xs font-bold disabled:opacity-40 hover:bg-[var(--color-ochre)]/10 transition-colors"
      >
        🛠 افزودن به سفارش... (ادمین)
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 right-0 w-80 bg-white border cut-line rounded-lg shadow-lg p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="کد سفارش یا اسم/ایمیل مشتری..."
            className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm mb-2"
          />

          {message && <p className="text-xs text-green-700 font-medium mb-2">{message}</p>}
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {loading ? (
              <p className="text-xs text-[var(--color-muted)] text-center py-3">در حال جستجو...</p>
            ) : orders.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)] text-center py-3">
                سفارشی در انتظار تأیید پیدا نشد.
              </p>
            ) : (
              orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => handleAdd(o.id)}
                  disabled={submittingId === o.id}
                  className="w-full text-right border cut-line rounded-lg p-2 text-xs hover:border-[var(--color-wine)] disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">#{o.id.slice(-8)}</span>
                    <span className="text-[var(--color-muted)]">{o.items.length} قلم</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--color-muted)]">
                    <span>{o.user.name ?? o.user.email}</span>
                    <span>{o.total.toLocaleString("fa-IR")} تومان</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

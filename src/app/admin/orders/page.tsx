"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  shippingCost: number | null;
  cargoCost: number | null;
  shippingGroupId: string | null;
  shippingGroup: { totalShippingCost: number; totalCargoCost: number; trackingCode: string | null } | null;
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

// فقط سفارش‌هایی که هنوز واقعاً ارسال نشدن و از قبل عضوِ یه گروهِ ترکیبیِ
// دیگه نیستن، قابلِ ترکیب‌کردنِ ارسال هستن -- دقیقاً همون گاردِ سمتِ سرور
function isCombinable(order: Order) {
  return order.status === "PROCESSING" && order.paymentStatus === "PAID" && !order.shippingGroupId;
}

function OrderRow({ order, indented }: { order: Order; indented?: boolean }) {
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className={`flex-1 block rounded-lg p-4 text-sm hover:border-[var(--color-wine)] transition-colors ${
        indented ? "bg-[var(--color-linen-dim)]/40" : "border cut-line bg-white"
      }`}
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
      <p className="font-bold text-[var(--color-wine)]">{order.total.toLocaleString("fa-IR")} تومان</p>
    </Link>
  );
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagQuery, setTagQuery] = useState("");
  const [tagSearching, setTagSearching] = useState(false);
  const [tagError, setTagError] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [combineOpen, setCombineOpen] = useState(false);
  const [combineTotal, setCombineTotal] = useState("");
  const [combineTracking, setCombineTracking] = useState("");
  const [combineOverrides, setCombineOverrides] = useState<Record<string, string>>({});
  const [combineError, setCombineError] = useState("");
  const [combineSubmitting, setCombineSubmitting] = useState(false);

  function loadOrders() {
    setLoading(true);
    return fetch("/api/admin/orders")
      .then((res) => (res.ok ? res.json() : []))
      .then(setOrders)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOrders();
  }, []);

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

  function toggleSelected(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  const selectedOrders = useMemo(() => orders.filter((o) => selected.has(o.id)), [orders, selected]);
  const selectedOldTotal = useMemo(
    () => selectedOrders.reduce((sum, o) => sum + (o.shippingCost ?? 0) + (o.cargoCost ?? 0), 0),
    [selectedOrders]
  );

  // پیش‌نمایشِ سهمِ هر سفارش: همون فرمولِ سمتِ سرور (متناسب با هزینه‌ی فعلیِ
  // خودش) -- مگر این‌که ادمین دستی برای همون سفارش عددی وارد کرده باشه
  function previewShare(order: Order, newTotal: number): number {
    const override = combineOverrides[order.id];
    if (override !== undefined && override.trim() !== "") return Number(override);
    const ownOld = (order.shippingCost ?? 0) + (order.cargoCost ?? 0);
    if (selectedOldTotal <= 0) return Math.round(newTotal / selectedOrders.length);
    return Math.round((ownOld / selectedOldTotal) * newTotal);
  }

  function openCombine() {
    setCombineTotal(String(selectedOldTotal));
    setCombineOverrides({});
    setCombineTracking("");
    setCombineError("");
    setCombineOpen(true);
  }

  async function submitCombine() {
    const total = Number(combineTotal);
    if (!total || total < 0) {
      setCombineError("هزینه‌ی کلِ جدید رو درست وارد کن");
      return;
    }
    setCombineError("");
    setCombineSubmitting(true);
    const shares: Record<string, number> = {};
    for (const [orderId, value] of Object.entries(combineOverrides)) {
      if (value.trim() !== "") shares[orderId] = Number(value);
    }
    const res = await fetch("/api/admin/shipping-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderIds: Array.from(selected),
        totalShippingCost: total,
        totalCargoCost: 0,
        shares: Object.keys(shares).length ? shares : undefined,
        trackingCode: combineTracking.trim() || undefined,
      }),
    });
    const data = await res.json();
    setCombineSubmitting(false);
    if (!res.ok) {
      setCombineError(data.error ?? "خطا در ترکیبِ ارسال");
      return;
    }
    setCombineOpen(false);
    setSelected(new Set());
    await loadOrders();
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  // گروه‌بندیِ بصری: سفارش‌هایی که shippingGroupId دارن، زیرِ یه کارتِ خلاصه‌ی
  // گروه (یه‌بار به‌ازای هر گروه، وقتی به اولین عضوش رسیدیم) نشون داده می‌شن
  const renderedGroupIds = new Set<string>();

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

      {selected.size >= 2 && (
        <div className="mb-4 flex items-center justify-between border cut-line rounded-lg p-3 bg-[var(--color-linen-dim)]/40">
          <span className="text-sm">{selected.size.toLocaleString("fa-IR")} سفارش انتخاب شده</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-[var(--color-muted)] px-3 py-2"
            >
              لغوِ انتخاب
            </button>
            <button
              onClick={openCombine}
              className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium"
            >
              ترکیبِ ارسال
            </button>
          </div>
        </div>
      )}

      {combineOpen && (
        <div className="mb-6 border-2 border-[var(--color-wine)] rounded-lg p-4 bg-white space-y-3">
          <h2 className="font-bold text-sm">ترکیبِ ارسالِ {selected.size.toLocaleString("fa-IR")} سفارش</h2>
          <p className="text-xs text-[var(--color-muted)]">
            جمعِ فعلیِ هزینه‌ی ارسال/باربریِ این سفارش‌ها: {selectedOldTotal.toLocaleString("fa-IR")} تومان
          </p>
          <div>
            <label className="text-xs font-medium block mb-1">هزینه‌ی کلِ جدید (بعد از ترکیب)</label>
            <input
              type="number"
              value={combineTotal}
              onChange={(e) => setCombineTotal(e.target.value)}
              className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">کدِ رهگیریِ مشترک (اختیاری)</label>
            <input
              value={combineTracking}
              onChange={(e) => setCombineTracking(e.target.value)}
              className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium">سهمِ هر سفارش (قابلِ ویرایش):</p>
            {selectedOrders.map((order) => {
              const total = Number(combineTotal) || 0;
              const share = previewShare(order, total);
              const diff = share - ((order.shippingCost ?? 0) + (order.cargoCost ?? 0));
              return (
                <div key={order.id} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0">#{order.id.slice(-8)}</span>
                  <input
                    type="number"
                    value={combineOverrides[order.id] ?? String(share)}
                    onChange={(e) =>
                      setCombineOverrides((prev) => ({ ...prev, [order.id]: e.target.value }))
                    }
                    className="w-28 border cut-line rounded-lg px-2 py-1"
                  />
                  <span className={diff < 0 ? "text-green-700" : diff > 0 ? "text-[var(--color-wine)]" : "text-[var(--color-muted)]"}>
                    {diff < 0
                      ? `${Math.abs(diff).toLocaleString("fa-IR")} تومان رفاند`
                      : diff > 0
                        ? `${diff.toLocaleString("fa-IR")} تومان اضافه‌پرداخت`
                        : "بدون تغییر"}
                  </span>
                </div>
              );
            })}
          </div>
          {combineError && <p className="text-xs text-red-600">{combineError}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={submitCombine}
              disabled={combineSubmitting}
              className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {combineSubmitting ? "در حال ثبت..." : "تأییدِ ترکیب"}
            </button>
            <button onClick={() => setCombineOpen(false)} className="text-xs text-[var(--color-muted)] px-3 py-2">
              انصراف
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((order) => {
          if (order.shippingGroupId) {
            if (renderedGroupIds.has(order.shippingGroupId)) return null;
            renderedGroupIds.add(order.shippingGroupId);
            const members = orders.filter((o) => o.shippingGroupId === order.shippingGroupId);
            const group = order.shippingGroup;
            return (
              <div key={order.shippingGroupId} className="border-2 cut-line border-[var(--color-wine)]/40 rounded-lg p-3 bg-[var(--color-linen-dim)]/20">
                <p className="text-xs font-bold text-[var(--color-wine)] mb-2">
                  ارسالِ ترکیبی · {members.length.toLocaleString("fa-IR")} سفارش · هزینه‌ی کل:{" "}
                  {((group?.totalShippingCost ?? 0) + (group?.totalCargoCost ?? 0)).toLocaleString("fa-IR")} تومان
                  {group?.trackingCode ? ` · کدِ رهگیری: ${group.trackingCode}` : ""}
                </p>
                <div className="space-y-2">
                  {members.map((member) => (
                    <OrderRow key={member.id} order={member} indented />
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div key={order.id} className="flex items-stretch gap-2">
              {isCombinable(order) && (
                <input
                  type="checkbox"
                  checked={selected.has(order.id)}
                  onChange={() => toggleSelected(order.id)}
                  className="mt-4 w-4 h-4 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <OrderRow order={order} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

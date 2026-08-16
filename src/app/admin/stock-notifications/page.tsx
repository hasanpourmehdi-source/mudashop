"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Notification = {
  id: string;
  description: string;
  createdAt: string;
  notifiedAt: string | null;
  reservedUntil: string | null;
  user: { name: string | null; email: string };
  product: { title: string; slug: string };
};

function requestStatus(n: Notification, now: number) {
  if (!n.notifiedAt) return { label: "در انتظار نوبت", tone: "muted" as const };
  if (n.reservedUntil && new Date(n.reservedUntil).getTime() >= now) {
    const until = new Date(n.reservedUntil).toLocaleString("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
    });
    return { label: `🔔 اطلاع داده شد — تا ${until} اولویت داره`, tone: "active" as const };
  }
  return { label: "⏰ مهلت اولویتش گذشت", tone: "expired" as const };
}

export default function AdminStockNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stock-notifications")
      .then((res) => (res.ok ? res.json() : []))
      .then(setNotifications)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  const now = Date.now();

  // گروه‌بندی بر اساس محصول+توضیح -- هر گروه صفِ درخواست‌های همون ترکیب مشخصه
  const grouped = new Map<
    string,
    { product: Notification["product"]; description: string; requests: Notification[] }
  >();
  for (const n of notifications) {
    const key = `${n.product.slug}::${n.description}`;
    if (!grouped.has(key)) {
      grouped.set(key, { product: n.product, description: n.description, requests: [] });
    }
    grouped.get(key)!.requests.push(n);
  }

  const groups = Array.from(grouped.values()).map((g) => ({
    ...g,
    requests: g.requests.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  }));
  // گروه‌هایی که هنوز کسی توشون در انتظاره بالاترن
  groups.sort((a, b) => {
    const aPending = a.requests.filter((r) => !r.notifiedAt).length;
    const bPending = b.requests.filter((r) => !r.notifiedAt).length;
    return Number(bPending) - Number(aPending) || b.requests.length - a.requests.length;
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">درخواست‌های «موجود شد خبرم کن» ({notifications.length})</h1>
      <p className="text-xs text-[var(--color-muted)] mb-6">
        وقتی موجودی یه ترکیب باز بشه، فقط قدیمی‌ترین درخواست‌کننده بلافاصله خبر می‌شه (۲۴ ساعت اولویت
        اطلاع‌رسانی داره)؛ اگه بعد از ۲۴ ساعت هنوز موجودی بود، نوبت به نفر بعدی می‌رسه. این فقط ترتیب
        پیام‌رسانیه، موجودی برای همه آزاده و هرکی زودتر بخره می‌بره.
      </p>
      {groups.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">هنوز درخواستی ثبت نشده.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g, i) => (
            <div key={i} className="border cut-line rounded-lg p-4 bg-white text-sm">
              <div className="flex items-center justify-between mb-2">
                <Link href={`/products/mazon/${g.product.slug}`} className="font-medium text-[var(--color-wine)]">
                  {g.product.title}
                </Link>
                <span className="text-xs bg-[var(--color-linen-dim)] px-2 py-1 rounded-full font-bold">
                  {g.requests.length.toLocaleString("fa-IR")} نفر
                </span>
              </div>
              <p className="text-[var(--color-muted)] mb-3">{g.description}</p>
              <div className="space-y-1.5">
                {g.requests.map((r, idx) => {
                  const status = requestStatus(r, now);
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${
                        status.tone === "active"
                          ? "bg-green-50"
                          : status.tone === "expired"
                          ? "bg-[var(--color-linen-dim)] opacity-70"
                          : "bg-[var(--color-linen-dim)]"
                      }`}
                    >
                      <span>
                        <strong>{idx + 1}.</strong> {r.user.name ?? r.user.email}
                      </span>
                      <span>{status.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

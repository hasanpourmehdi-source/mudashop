"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AlertRow = {
  id: string;
  targetPrice: number;
  notifiedAt: string | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
  product: { title: string; slug: string } | null;
};

// لیست اخطارهای کاهش قیمت -- فعال (در انتظار) و آتش‌زده، جدیدترین اول.
export default function AdminPriceAlertsPage() {
  const [data, setData] = useState<{ active: AlertRow[]; fired: AlertRow[] } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/price-alerts");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;
  }

  const renderRows = (rows: AlertRow[], emptyText: string) =>
    rows.length === 0 ? (
      <p className="text-sm text-[var(--color-muted)]">{emptyText}</p>
    ) : (
      <div className="space-y-2">
        {rows.map((a) => (
          <div key={a.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{a.user?.name ?? a.user?.email ?? a.id.slice(-6)}</span>
              <span className="text-xs text-[var(--color-muted)]">
                {new Date(a.createdAt).toLocaleDateString("fa-IR")}
              </span>
            </div>
            {a.product ? (
              <Link
                href={`/products/mazon/${a.product.slug}`}
                className="text-xs text-[var(--color-wine)]"
                target="_blank"
              >
                {a.product.title}
              </Link>
            ) : (
              <span className="text-xs text-[var(--color-muted)]">محصول حذف شده</span>
            )}
            <div className="flex gap-3 mt-1 text-xs">
              <span>مبلغ هدف: <b>{a.targetPrice.toLocaleString("fa-IR")} تومان</b></span>
              {a.notifiedAt && (
                <span className="text-emerald-700">
                  اطلاع داده شد: {new Date(a.notifiedAt).toLocaleDateString("fa-IR")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-4">در انتظار کاهش قیمت ({data.active.length})</h1>
        {renderRows(data.active, "اخطار فعالی وجود ندارد.")}
      </div>
      <div>
        <h2 className="text-lg font-bold mb-4">اطلاع‌داده‌شده ({data.fired.length})</h2>
        {renderRows(data.fired, "هنوز اخطاری آتش نزده است.")}
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Report = {
  id: string;
  source: "MAZON" | "TRENDYOL";
  externalId: string | null;
  reportedPrice: number;
  note: string | null;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  product: { title: string; slug: string } | null;
  user: { name: string | null; email: string } | null;
};

function ProductLink({ r }: { r: Report }) {
  if (r.source === "MAZON" && r.product) {
    return (
      <Link href={`/products/mazon/${r.product.slug}`} className="text-xs text-[var(--color-wine)]">
        {r.product.title}
      </Link>
    );
  }
  return (
    <Link href={`/products/trendyol/${r.externalId}`} className="text-xs text-[var(--color-wine)]">
      محصول ترندیول (شناسه: {r.externalId})
    </Link>
  );
}

export default function AdminPriceReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/admin/price-reports")
      .then((res) => (res.ok ? res.json() : []))
      .then(setReports)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleUpdate(id: string, status: "RESOLVED" | "DISMISSED") {
    setError("");
    const res = await fetch(`/api/admin/price-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `خطا در ثبت (کد ${res.status})`);
      return;
    }
    load();
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  const pending = reports.filter((r) => r.status === "PENDING");
  const handled = reports.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-6">گزارش‌های بررسی‌نشده ({pending.length})</h1>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">گزارشِ بررسی‌نشده‌ای وجود ندارد.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="border cut-line rounded-lg p-4 bg-white text-sm">
                <ProductLink r={r} />
                <p className="font-medium mt-1">
                  قیمتِ گزارش‌شده: {r.reportedPrice.toLocaleString("fa-IR")} تومان
                </p>
                {r.note && <p className="text-xs text-[var(--color-muted)] mt-1">{r.note}</p>}
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  {r.user?.name ?? r.user?.email ?? "کاربرِ مهمان"} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString("fa-IR")}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleUpdate(r.id, "RESOLVED")}
                    className="bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full text-xs font-medium"
                  >
                    بررسی شد
                  </button>
                  <button
                    onClick={() => handleUpdate(r.id, "DISMISSED")}
                    className="text-red-600 border cut-line px-3 py-1.5 rounded-full text-xs font-medium"
                  >
                    رد کردن
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">بررسی‌شده‌ها ({handled.length})</h2>
        <div className="space-y-2">
          {handled.map((r) => (
            <div key={r.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
              <ProductLink r={r} />
              <p className="font-medium mt-1">{r.reportedPrice.toLocaleString("fa-IR")} تومان</p>
              {r.note && <p className="text-xs text-[var(--color-muted)] mt-1">{r.note}</p>}
              <span
                className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  r.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {r.status === "RESOLVED" ? "بررسی شد" : "رد شد"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

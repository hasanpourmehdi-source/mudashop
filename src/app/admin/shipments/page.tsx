"use client";

import { useEffect, useState } from "react";

type EligibleItem = {
  id: string;
  title: string;
  quantity: number;
  purchaseTag: string | null;
  itemWeightGrams: number | null;
  orderId: string;
  order: { id: string; user: { name: string | null; email: string } };
};

type ShipmentItem = {
  id: string;
  title: string;
  itemWeightGrams: number | null;
  itemCargoCost: number | null;
  orderId: string;
  order: { id: string; user: { name: string | null; email: string } };
};

type Shipment = {
  id: string;
  label: string | null;
  totalWeightGrams: number | null;
  totalCargoCost: number | null;
  trackingCode: string | null;
  shippedAt: string | null;
  createdAt: string;
  items: ShipmentItem[];
};

const fmt = (n: number) => n.toLocaleString("fa-IR");

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [eligible, setEligible] = useState<EligibleItem[]>([]);
  const [label, setLabel] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const [totalCargoCostInput, setTotalCargoCostInput] = useState("");
  const [trackingCodeInput, setTrackingCodeInput] = useState("");
  const [shares, setShares] = useState<Record<string, { orderId: string; cargoCostShare: number }[]>>({});
  const [error, setError] = useState("");

  async function load() {
    const [sRes, eRes] = await Promise.all([
      fetch("/api/admin/shipments"),
      fetch("/api/admin/shipments/eligible-items"),
    ]);
    if (sRes.ok) setShipments(await sRes.json());
    if (eRes.ok) setEligible(await eRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function createShipment() {
    await fetch("/api/admin/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label || undefined }),
    });
    setLabel("");
    load();
  }

  async function addItem(shipmentId: string, itemId: string) {
    setError("");
    const weight = Number(weightInputs[itemId]);
    if (!weight || weight <= 0) {
      setError("وزنِ این قلم را (به گرم) وارد کنید");
      return;
    }
    const res = await fetch(`/api/admin/shipments/${shipmentId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, weightGrams: weight }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "خطا در افزودن قلم");
      return;
    }
    load();
  }

  async function removeItem(shipmentId: string, itemId: string) {
    await fetch(`/api/admin/shipments/${shipmentId}/items/${itemId}`, { method: "DELETE" });
    load();
  }

  async function finalize(shipmentId: string) {
    setError("");
    const totalCargoCost = Number(totalCargoCostInput);
    if (!totalCargoCost || totalCargoCost <= 0) {
      setError("هزینه‌ی باربریِ کل محموله را وارد کنید");
      return;
    }
    const res = await fetch(`/api/admin/shipments/${shipmentId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalCargoCost, trackingCode: trackingCodeInput || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "خطا در نهایی‌سازی");
      return;
    }
    setShares((prev) => ({ ...prev, [shipmentId]: data.orderShares }));
    setTotalCargoCostInput("");
    setTrackingCodeInput("");
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold mb-2">محموله‌های ترکیبی (خریدِ گروهی)</h1>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          چند قلمِ خریداری‌شده از سفارش‌های مختلف رو که با هم ارسال می‌شن، توی یک
          محموله جمع کن. با وارد کردنِ وزنِ هر قلم و هزینه‌ی باربریِ کلِ محموله،
          سهمِ هر قلم/سفارش بر اساس وزن حساب می‌شه — همون عدد رو توی فرمِ «تعیین
          هزینه ارسال» همون سفارش وارد کن.
        </p>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="یادداشت (مثلاً «محموله‌ی ۲۵ شهریور - ترکیه»)"
            className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={createShipment}
            className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium shrink-0"
          >
            + محموله‌ی جدید
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-4">
        {shipments.map((s) => {
          const open = expandedId === s.id;
          const isFinal = Boolean(s.shippedAt);
          return (
            <div key={s.id} className="border cut-line rounded-xl bg-white">
              <button
                onClick={() => setExpandedId(open ? null : s.id)}
                className="w-full flex items-center justify-between p-4 text-right"
              >
                <div>
                  <p className="font-medium text-sm">{s.label || `محموله #${s.id.slice(-6)}`}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {s.items.length.toLocaleString("fa-IR")} قلم
                    {isFinal && ` — نهایی شد (${fmt(s.totalCargoCost ?? 0)} تومان، ${fmt(s.totalWeightGrams ?? 0)} گرم)`}
                  </p>
                </div>
                <span className="text-xs text-[var(--color-wine)]">{open ? "بستن" : "جزئیات"}</span>
              </button>

              {open && (
                <div className="border-t cut-line p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold mb-2">اقلامِ این محموله</h3>
                    {s.items.length === 0 ? (
                      <p className="text-xs text-[var(--color-muted)]">هنوز قلمی اضافه نشده.</p>
                    ) : (
                      <ul className="text-sm divide-y divide-[var(--color-linen-dim)]">
                        {s.items.map((i) => (
                          <li key={i.id} className="py-2 flex items-center justify-between gap-2">
                            <span>
                              {i.title} — {i.order.user.name ?? i.order.user.email} — {fmt(i.itemWeightGrams ?? 0)} گرم
                              {i.itemCargoCost != null && ` — سهم: ${fmt(i.itemCargoCost)} تومان`}
                            </span>
                            {!isFinal && (
                              <button
                                onClick={() => removeItem(s.id, i.id)}
                                className="text-red-600 hover:underline text-xs shrink-0"
                              >
                                حذف
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {!isFinal && (
                    <>
                      <div>
                        <h3 className="text-sm font-bold mb-2">افزودن قلمِ خریداری‌شده</h3>
                        {eligible.length === 0 ? (
                          <p className="text-xs text-[var(--color-muted)]">فعلاً هیچ قلمِ خریداری‌شده‌ی بدون‌محمولهی وجود ندارد.</p>
                        ) : (
                          <ul className="text-sm divide-y divide-[var(--color-linen-dim)]">
                            {eligible.map((i) => (
                              <li key={i.id} className="py-2 flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate">
                                  {i.title} — {i.order.user.name ?? i.order.user.email} {i.purchaseTag && `— ${i.purchaseTag}`}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <input
                                    type="number"
                                    placeholder="وزن (گرم)"
                                    value={weightInputs[i.id] ?? ""}
                                    onChange={(e) => setWeightInputs((prev) => ({ ...prev, [i.id]: e.target.value }))}
                                    className="w-24 border cut-line rounded px-2 py-1 text-xs"
                                  />
                                  <button
                                    onClick={() => addItem(s.id, i.id)}
                                    className="border cut-line rounded-full px-3 py-1 text-xs font-medium"
                                  >
                                    افزودن
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="border-t cut-line pt-3 space-y-2">
                        <h3 className="text-sm font-bold">نهایی‌سازی و تقسیمِ هزینه</h3>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="هزینه‌ی باربریِ کل محموله (تومان)"
                            value={totalCargoCostInput}
                            onChange={(e) => setTotalCargoCostInput(e.target.value)}
                            className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm"
                          />
                          <input
                            placeholder="کد رهگیری (اختیاری)"
                            value={trackingCodeInput}
                            onChange={(e) => setTrackingCodeInput(e.target.value)}
                            className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          onClick={() => finalize(s.id)}
                          disabled={s.items.length === 0}
                          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
                        >
                          نهایی‌سازی و تقسیمِ هزینه
                        </button>
                      </div>
                    </>
                  )}

                  {shares[s.id] && (
                    <div className="border-t cut-line pt-3">
                      <h3 className="text-sm font-bold mb-2">سهمِ هر سفارش (وارد کن توی فرمِ هزینه ارسال همون سفارش)</h3>
                      <ul className="text-sm space-y-1">
                        {shares[s.id].map((row) => (
                          <li key={row.orderId} className="flex justify-between">
                            <a href={`/admin/orders/${row.orderId}`} className="text-[var(--color-wine)] hover:underline">
                              سفارش #{row.orderId.slice(-8)}
                            </a>
                            <span className="font-medium">{fmt(row.cargoCostShare)} تومان</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {shipments.length === 0 && <p className="text-sm text-[var(--color-muted)]">هنوز محموله‌ای ساخته نشده.</p>}
      </div>
    </div>
  );
}

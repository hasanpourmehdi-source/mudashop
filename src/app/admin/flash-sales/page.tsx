"use client";

import { useEffect, useState } from "react";
import { PersianDateTimeInput } from "@/components/PersianDateTimeInput";

type Product = { id: string; title: string };
type FlashSale = {
  id: string;
  discountPercent: number;
  stock: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  product: { title: string; slug: string };
};

export default function AdminFlashSalesPage() {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const [form, setForm] = useState({
    productId: "",
    discountPercent: "30",
    stock: "20",
    startsAt: now.toISOString(),
    endsAt: inTwoHours.toISOString(),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    discountPercent: "0",
    stock: "0",
    startsAt: "",
    endsAt: "",
  });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    Promise.all([
      fetch("/api/admin/flash-sales").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/admin/products").then((res) => (res.ok ? res.json() : [])),
    ]).then(([fs, products]) => {
      setFlashSales(fs);
      setProducts(products);
    });
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/admin/flash-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: form.productId,
        discountPercent: Number(form.discountPercent),
        stock: Number(form.stock),
        startsAt: form.startsAt,
        endsAt: form.endsAt,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره حراج");
      return;
    }
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/flash-sales/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این حراج قطعی است؟")) return;
    await fetch(`/api/admin/flash-sales/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(f: FlashSale) {
    setEditingId(f.id);
    setEditForm({
      discountPercent: String(f.discountPercent),
      stock: String(f.stock),
      startsAt: f.startsAt,
      endsAt: f.endsAt,
    });
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const res = await fetch(`/api/admin/flash-sales/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discountPercent: Number(editForm.discountPercent),
        stock: Number(editForm.stock),
        startsAt: editForm.startsAt,
        endsAt: editForm.endsAt,
      }),
    });
    const data = await res.json();
    setEditSaving(false);
    if (!res.ok) {
      setEditError(data.error ?? "خطا در ذخیره تغییرات");
      return;
    }
    setEditingId(null);
    load();
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-6">افزودن حراج فلش جدید</h1>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <select
            required
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white sm:col-span-2"
          >
            <option value="">انتخاب محصول</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="درصد تخفیف حراج"
            required
            value={form.discountPercent}
            onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <input
            type="number"
            placeholder="موجودی مخصوص حراج"
            required
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <label className="text-xs text-[var(--color-muted)]">
            شروع
            <div className="mt-1">
              <PersianDateTimeInput
                value={form.startsAt}
                onChange={(iso) => setForm({ ...form, startsAt: iso })}
              />
            </div>
          </label>
          <label className="text-xs text-[var(--color-muted)]">
            پایان
            <div className="mt-1">
              <PersianDateTimeInput
                value={form.endsAt}
                onChange={(iso) => setForm({ ...form, endsAt: iso })}
              />
            </div>
          </label>

          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ایجاد حراج"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">حراج‌های ثبت‌شده ({flashSales.length})</h2>
        <div className="space-y-2">
          {flashSales.map((f) =>
            editingId === f.id ? (
              <form
                key={f.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(f.id);
                }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <p className="text-sm font-medium">{f.product.title}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="درصد تخفیف"
                    value={editForm.discountPercent}
                    onChange={(e) => setEditForm({ ...editForm, discountPercent: e.target.value })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="موجودی"
                    value={editForm.stock}
                    onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                  />
                  <PersianDateTimeInput
                    value={editForm.startsAt}
                    onChange={(iso) => setEditForm({ ...editForm, startsAt: iso })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm w-full"
                  />
                  <PersianDateTimeInput
                    value={editForm.endsAt}
                    onChange={(iso) => setEditForm({ ...editForm, endsAt: iso })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm w-full"
                  />
                </div>
                {editError && <p className="text-xs text-red-600">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="text-xs bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full disabled:opacity-50"
                  >
                    {editSaving ? "..." : "ذخیره"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-[var(--color-muted)]"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            ) : (
              <div key={f.id} className="flex items-center justify-between border cut-line rounded-lg p-3 bg-white text-sm">
                <div>
                  <p className="font-medium">
                    {f.product.title} — {f.discountPercent}% تخفیف
                  </p>
                  <p className="text-[var(--color-muted)] text-xs">
                    موجودی: {f.stock} · {new Date(f.startsAt).toLocaleString("fa-IR")} تا{" "}
                    {new Date(f.endsAt).toLocaleString("fa-IR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(f.id, f.isActive)}
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      f.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {f.isActive ? "فعال" : "غیرفعال"}
                  </button>
                  <button onClick={() => startEdit(f)} className="text-[var(--color-wine)] hover:underline">
                    ویرایش
                  </button>
                  <button onClick={() => handleDelete(f.id)} className="text-red-600 hover:underline">
                    حذف
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

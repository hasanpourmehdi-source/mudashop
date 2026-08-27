"use client";

import { useEffect, useState } from "react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { PersianDateTimeInput } from "@/components/PersianDateTimeInput";

type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIP" | "FIRST_BUY";
  value: number;
  minOrderAmount: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
  showcaseOnProducts: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  PERCENT: "درصدی",
  FIXED: "مبلغ ثابت",
  FREE_SHIP: "ارسال رایگان",
  FIRST_BUY: "اولین خرید",
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState({
    code: "",
    type: "PERCENT" as Coupon["type"],
    value: "10",
    minOrderAmount: "0",
    maxUses: "",
    expiresAt: "",
    showcaseOnProducts: false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    code: "",
    type: "PERCENT" as Coupon["type"],
    value: "0",
    minOrderAmount: "0",
    maxUses: "",
    expiresAt: "",
    showcaseOnProducts: false,
  });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch("/api/admin/coupons")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCoupons);
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        type: form.type,
        value: Number(form.value) || 0,
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
        showcaseOnProducts: form.showcaseOnProducts,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره کوپن");
      return;
    }

    setForm({ code: "", type: "PERCENT", value: "10", minOrderAmount: "0", maxUses: "", expiresAt: "", showcaseOnProducts: false });
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function toggleShowcase(id: string, showcaseOnProducts: boolean) {
    await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showcaseOnProducts: !showcaseOnProducts }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این کوپن قطعی است؟")) return;
    await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(c: Coupon) {
    setEditingId(c.id);
    setEditForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      minOrderAmount: String(c.minOrderAmount),
      maxUses: c.maxUses ? String(c.maxUses) : "",
      expiresAt: c.expiresAt ?? "",
      showcaseOnProducts: c.showcaseOnProducts,
    });
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const res = await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: editForm.code,
        type: editForm.type,
        value: Number(editForm.value) || 0,
        minOrderAmount: Number(editForm.minOrderAmount) || 0,
        maxUses: editForm.maxUses ? Number(editForm.maxUses) : null,
        expiresAt: editForm.expiresAt || null,
        showcaseOnProducts: editForm.showcaseOnProducts,
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
        <h1 className="text-xl font-bold mb-6">افزودن کد تخفیف جدید</h1>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <input
            placeholder="کد (مثلا WELCOME10)"
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as Coupon["type"] })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          >
            <option value="PERCENT">درصدی</option>
            <option value="FIXED">مبلغ ثابت</option>
            <option value="FREE_SHIP">ارسال رایگان</option>
            <option value="FIRST_BUY">فقط اولین خرید (درصدی)</option>
          </select>
          {form.type !== "FREE_SHIP" && (
            form.type === "FIXED" ? (
              <CurrencyInput
                placeholder="مبلغ (تومان)"
                value={form.value}
                onChange={(v) => setForm({ ...form, value: v })}
                className="border cut-line rounded-lg px-3 py-2 bg-white"
              />
            ) : (
              <input
                type="number"
                placeholder="درصد تخفیف"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="border cut-line rounded-lg px-3 py-2 bg-white"
              />
            )
          )}
          <CurrencyInput
            placeholder="حداقل مبلغ سفارش (تومان)"
            value={form.minOrderAmount}
            onChange={(v) => setForm({ ...form, minOrderAmount: v })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <input
            type="number"
            placeholder="حداکثر تعداد استفاده (خالی = نامحدود)"
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <PersianDateTimeInput
            value={form.expiresAt}
            onChange={(iso) => setForm({ ...form, expiresAt: iso })}
            showTime={false}
            placeholder="تاریخ انقضا (اختیاری)"
            className="border cut-line rounded-lg px-3 py-2 bg-white w-full text-sm"
          />
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.showcaseOnProducts}
              onChange={(e) => setForm({ ...form, showcaseOnProducts: e.target.checked })}
            />
            نمایش این کد به‌عنوان بج تبلیغاتی روی صفحه‌ی محصولاتِ مزون
          </label>

          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره کوپن"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">کدهای تخفیف ({coupons.length})</h2>
        <div className="space-y-2">
          {coupons.map((c) =>
            editingId === c.id ? (
              <form
                key={c.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(c.id);
                }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                    required
                  />
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as Coupon["type"] })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="PERCENT">درصدی</option>
                    <option value="FIXED">مبلغ ثابت</option>
                    <option value="FREE_SHIP">ارسال رایگان</option>
                    <option value="FIRST_BUY">فقط اولین خرید (درصدی)</option>
                  </select>
                  {editForm.type !== "FREE_SHIP" && (
                    editForm.type === "FIXED" ? (
                      <CurrencyInput
                        placeholder="مقدار (تومان)"
                        value={editForm.value}
                        onChange={(v) => setEditForm({ ...editForm, value: v })}
                        className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                      />
                    ) : (
                      <input
                        type="number"
                        placeholder="مقدار"
                        value={editForm.value}
                        onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                        className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                      />
                    )
                  )}
                  <CurrencyInput
                    placeholder="حداقل مبلغ سفارش"
                    value={editForm.minOrderAmount}
                    onChange={(v) => setEditForm({ ...editForm, minOrderAmount: v })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="حداکثر تعداد استفاده"
                    value={editForm.maxUses}
                    onChange={(e) => setEditForm({ ...editForm, maxUses: e.target.value })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                  />
                  <PersianDateTimeInput
                    value={editForm.expiresAt}
                    onChange={(iso) => setEditForm({ ...editForm, expiresAt: iso })}
                    showTime={false}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm w-full"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={editForm.showcaseOnProducts}
                    onChange={(e) => setEditForm({ ...editForm, showcaseOnProducts: e.target.checked })}
                  />
                  نمایش این کد به‌عنوان بج تبلیغاتی روی صفحه‌ی محصولاتِ مزون
                </label>
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
              <div key={c.id} className="flex items-center justify-between border cut-line rounded-lg p-3 bg-white text-sm">
                <div>
                  <p className="font-medium">
                    {c.code} — {TYPE_LABELS[c.type]}
                    {c.type !== "FREE_SHIP" && ` (${c.value}${c.type === "FIXED" ? " تومان" : "%"})`}
                  </p>
                  <p className="text-[var(--color-muted)] text-xs">
                    استفاده: {c.usedCount}
                    {c.maxUses ? ` از ${c.maxUses}` : " (نامحدود)"}
                    {c.expiresAt && ` · انقضا: ${new Date(c.expiresAt).toLocaleDateString("fa-IR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(c.id, c.isActive)}
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.isActive ? "فعال" : "غیرفعال"}
                  </button>
                  <button
                    onClick={() => toggleShowcase(c.id, c.showcaseOnProducts)}
                    title="نمایش به‌عنوان بج تبلیغاتی روی صفحه‌ی محصولاتِ مزون"
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      c.showcaseOnProducts ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.showcaseOnProducts ? "نمایش‌داده‌شده روی محصولات" : "نمایش روی محصولات خاموش"}
                  </button>
                  <button onClick={() => startEdit(c)} className="text-[var(--color-wine)] hover:underline">
                    ویرایش
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline">
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

"use client";

import { useEffect, useState } from "react";

type ExchangeRate = {
  id: string;
  currency: string;
  currencyLabel: string;
  rate: number;
  profitPercent: number;
  updatedAt: string;
};

function computeFinal(rate: number, profitPercent: number): number {
  return Math.round(rate * (1 + profitPercent / 100));
}

export default function AdminExchangeRatesPage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  const [currency, setCurrency] = useState("");
  const [currencyLabel, setCurrencyLabel] = useState("");
  const [rate, setRate] = useState("");
  const [profitPercent, setProfitPercent] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editProfit, setEditProfit] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch("/api/admin/exchange-rates")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRates)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/exchange-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency,
        currencyLabel,
        rate: Number(rate),
        profitPercent: Number(profitPercent || 0),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره نرخ ارز");
      return;
    }
    setCurrency("");
    setCurrencyLabel("");
    setRate("");
    setProfitPercent("");
    load();
  }

  async function handleDelete(r: ExchangeRate) {
    if (!confirm(`حذف نرخ ${r.currencyLabel} (${r.currency}) قطعی است؟`)) return;
    await fetch(`/api/admin/exchange-rates/${r.id}`, { method: "DELETE" });
    load();
  }

  function startEdit(r: ExchangeRate) {
    setEditingId(r.id);
    setEditLabel(r.currencyLabel);
    setEditRate(String(r.rate));
    setEditProfit(String(r.profitPercent));
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const res = await fetch(`/api/admin/exchange-rates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currencyLabel: editLabel,
        rate: Number(editRate),
        profitPercent: Number(editProfit || 0),
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

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-2">نرخ ارز</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          قیمت محصولات سایت‌های خارجی (مثل ترندیول) با ضرب قیمت ارزی در این نرخ + درصد سود، به تومان
          محاسبه و نمایش داده می‌شه. همیشه نرخ *فعلی* (نه نرخ لحظه‌ی سفارش قدیمی) استفاده می‌شه، پس
          هر بار این‌جا آپدیت کنی، بلافاصله روی همه‌ی قیمت‌های سایت اثر می‌ذاره.
        </p>
        <form onSubmit={handleCreate} className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl items-start">
          <input
            placeholder="کد ارز (مثلا TRY)"
            required
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="border cut-line rounded-lg px-3 py-2 bg-white text-sm"
          />
          <input
            placeholder="نام فارسی (لیر ترکیه)"
            required
            value={currencyLabel}
            onChange={(e) => setCurrencyLabel(e.target.value)}
            className="border cut-line rounded-lg px-3 py-2 bg-white text-sm"
          />
          <input
            placeholder="نرخ پایه (تومان)"
            type="number"
            step="any"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="border cut-line rounded-lg px-3 py-2 bg-white text-sm"
          />
          <input
            placeholder="درصد سود"
            type="number"
            step="any"
            value={profitPercent}
            onChange={(e) => setProfitPercent(e.target.value)}
            className="border cut-line rounded-lg px-3 py-2 bg-white text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="col-span-2 sm:col-span-4 bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50 w-fit"
          >
            {saving ? "..." : "افزودن ارز جدید"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">ارزهای ثبت‌شده ({rates.length})</h2>
        <div className="space-y-2 max-w-2xl">
          {rates.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">هنوز هیچ نرخی ثبت نشده.</p>
          )}
          {rates.map((r) =>
            editingId === r.id ? (
              <form
                key={r.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(r.id);
                }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="نام فارسی"
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                    required
                  />
                  <input
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    type="number"
                    step="any"
                    placeholder="نرخ پایه"
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                    required
                  />
                  <input
                    value={editProfit}
                    onChange={(e) => setEditProfit(e.target.value)}
                    type="number"
                    step="any"
                    placeholder="درصد سود"
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
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
              <div key={r.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">
                    {r.currencyLabel} <span className="text-[var(--color-muted)]">({r.currency})</span>
                  </span>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(r)} className="text-[var(--color-wine)] hover:underline">
                      ویرایش
                    </button>
                    <button onClick={() => handleDelete(r)} className="text-red-600 hover:underline">
                      حذف
                    </button>
                  </div>
                </div>
                <p className="text-[var(--color-muted)] text-xs">
                  نرخ پایه: {r.rate.toLocaleString("fa-IR")} تومان · سود: {r.profitPercent.toLocaleString("fa-IR")}%
                  · یعنی هر ۱ واحد {r.currency} ={" "}
                  {computeFinal(r.rate, r.profitPercent).toLocaleString("fa-IR")} تومان
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

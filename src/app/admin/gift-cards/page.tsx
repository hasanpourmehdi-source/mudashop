"use client";

import { useCallback, useEffect, useState } from "react";

type GiftCardRow = {
  id: string;
  code: string;
  initialAmount: number;
  balance: number;
  message: string | null;
  recipientEmail: string | null;
  isActive: boolean;
  createdAt: string;
  redeemedAt: string | null;
  buyerUser: { name: string | null; email: string } | null;
  redeemedByUser: { name: string | null; email: string } | null;
};

// مدیریت کارت‌های هدیه: ساخت دستی (قرعه‌کشی/جایزه) + فعال/غیرفعال‌کردن
export default function AdminGiftCardsPage() {
  const [cards, setCards] = useState<GiftCardRow[] | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/gift-cards");
    if (res.ok) setCards((await res.json()).cards);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setError("");
    setNotice("");
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1_000) {
      setError("حداقل مبلغ ۱٬۰۰۰ تومان است");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/admin/gift-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value, message: message || null }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error ?? "خطا در ساخت کارت");
      return;
    }
    setNotice(`کارت با کد ${body.card.code} ساخته شد.`);
    setAmount("");
    setMessage("");
    load();
  }

  async function toggle(id: string) {
    await fetch(`/api/admin/gift-cards/${id}/toggle`, { method: "POST" });
    load();
  }

  const fmt = (n: number) => n.toLocaleString("fa-IR");

  if (!cards) {
    return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;
  }

  return (
    <div className="space-y-8">
      <section className="border cut-line rounded-xl p-5 bg-white space-y-3 max-w-lg">
        <h1 className="font-bold">ساخت کارت هدیه</h1>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="مبلغ (تومان)"
            className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm min-w-0"
          />
          <span className="text-[11px] text-[var(--color-muted)] whitespace-nowrap">تومان</span>
        </div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="پیام روی کارت (اختیاری)"
          maxLength={200}
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={create}
          disabled={creating}
          className="bg-[var(--color-wine)] text-white rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          {creating ? "..." : "ساخت کارت"}
        </button>
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">کارت‌ها ({cards.length})</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">کارتی ساخته نشده است.</p>
        ) : (
          <div className="space-y-2">
            {cards.map((c) => (
              <div key={c.id} className="border cut-line rounded-lg p-3 bg-white text-sm flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs" dir="ltr">
                    {c.code}{" "}
                    <span className={`text-[10px] ${c.isActive ? "text-emerald-700" : "text-red-600"}`}>
                      {c.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5 truncate">
                    {c.message ?? "بدون پیام"} — خریدار: {c.buyerUser?.name ?? c.buyerUser?.email ?? "ادمین"}
                  </p>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    {c.redeemedAt
                      ? `فعال شده توسط ${c.redeemedByUser?.name ?? c.redeemedByUser?.email ?? "-"} در ${new Date(c.redeemedAt).toLocaleDateString("fa-IR")}`
                      : "هنوز فعال نشده"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold">{fmt(c.initialAmount)} تومان</p>
                    <p className="text-[11px] text-[var(--color-muted)]">موجودی: {fmt(c.balance)}</p>
                  </div>
                  <button
                    onClick={() => toggle(c.id)}
                    className="text-xs text-[var(--color-wine)] underline whitespace-nowrap"
                  >
                    {c.isActive ? "غیرفعال کن" : "فعال کن"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
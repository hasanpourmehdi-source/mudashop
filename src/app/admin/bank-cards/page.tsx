"use client";

import { useEffect, useState } from "react";

type BankCard = {
  id: string;
  cardNumber: string;
  shebaNumber: string | null;
  holderName: string;
  label: string | null;
  isActive: boolean;
  isDefault: boolean;
};

// شماره کارت رو همیشه به فرمت گروه‌های ۴تایی جدا با خط‌تیره نگه می‌داره (مثلاً
// 6037-9977-1234-5678)، حتی اگه کاربر فقط رقم پشت رقم تایپ کنه
function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.match(/.{1,4}/g)?.join("-") ?? digits;
}

// شماره شبا رو با پیشوند IR و گروه‌های ۴تایی جدا با فاصله نگه می‌داره (مثلاً
// IR82 0540 1026 8002 0817 9002)
function formatSheba(raw: string): string {
  let cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned && !cleaned.startsWith("IR")) {
    cleaned = "IR" + cleaned.replace(/^I?R?/, "");
  }
  cleaned = cleaned.slice(0, 26); // IR + ۲۴ رقم
  return cleaned.match(/.{1,4}/g)?.join(" ") ?? cleaned;
}

export default function AdminBankCardsPage() {
  const [cards, setCards] = useState<BankCard[]>([]);
  const [cardNumber, setCardNumber] = useState("");
  const [shebaNumber, setShebaNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCardNumber, setEditCardNumber] = useState("");
  const [editShebaNumber, setEditShebaNumber] = useState("");
  const [editHolderName, setEditHolderName] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch("/api/admin/bank-cards")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCards);
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/bank-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardNumber,
        shebaNumber: shebaNumber || undefined,
        holderName,
        label: label || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره کارت");
      return;
    }
    setCardNumber("");
    setShebaNumber("");
    setHolderName("");
    setLabel("");
    load();
  }

  async function handleDelete(card: BankCard) {
    if (!confirm("حذف این کارت قطعی است؟")) return;
    await fetch(`/api/admin/bank-cards/${card.id}`, { method: "DELETE" });
    load();
  }

  async function toggleActive(card: BankCard) {
    await fetch(`/api/admin/bank-cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !card.isActive }),
    });
    load();
  }

  // فقط وقتی «تأییدِ اولیه‌ی سفارش» از تنظیمات خاموشه معنا داره -- سیستم
  // خودش بدونِ دخالتِ ادمین این کارت رو برای مشتری‌های جدید تخصیص می‌ده
  async function makeDefault(card: BankCard) {
    await fetch(`/api/admin/bank-cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  function startEdit(card: BankCard) {
    setEditingId(card.id);
    setEditCardNumber(card.cardNumber);
    setEditShebaNumber(card.shebaNumber ?? "");
    setEditHolderName(card.holderName);
    setEditLabel(card.label ?? "");
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const res = await fetch(`/api/admin/bank-cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardNumber: editCardNumber,
        shebaNumber: editShebaNumber || undefined,
        holderName: editHolderName,
        label: editLabel || undefined,
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
        <h1 className="text-xl font-bold mb-2">افزودن کارت بانکی جدید</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          موقع بررسی هر سفارش، از بین کارت‌های فعال یکی رو انتخاب و به مشتری تخصیص می‌دید.
        </p>
        <form onSubmit={handleCreate} className="space-y-2 max-w-md">
          <input
            placeholder="شماره کارت (مثلاً 6037-9977-XXXX-XXXX)"
            required
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            dir="ltr"
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm text-center tracking-widest bg-white"
          />
          <input
            placeholder="شماره شبا (اختیاری -- مثلاً IR820540102680020817909002)"
            value={shebaNumber}
            onChange={(e) => setShebaNumber(formatSheba(e.target.value))}
            dir="ltr"
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm text-center tracking-widest bg-white"
          />
          <input
            placeholder="نام صاحب حساب"
            required
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            placeholder="برچسب اختیاری (مثلاً بانک ملی)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {saving ? "..." : "افزودن کارت"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">کارت‌های ثبت‌شده ({cards.length})</h2>
        <div className="space-y-2 max-w-md">
          {cards.map((card) =>
            editingId === card.id ? (
              <form
                key={card.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(card.id);
                }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <input
                  value={editCardNumber}
                  onChange={(e) => setEditCardNumber(formatCardNumber(e.target.value))}
                  dir="ltr"
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm text-center tracking-widest"
                  required
                />
                <input
                  value={editShebaNumber}
                  onChange={(e) => setEditShebaNumber(formatSheba(e.target.value))}
                  placeholder="شماره شبا (اختیاری)"
                  dir="ltr"
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm text-center tracking-widest"
                />
                <input
                  value={editHolderName}
                  onChange={(e) => setEditHolderName(e.target.value)}
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm"
                  required
                />
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="برچسب اختیاری"
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm"
                />
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
              <div key={card.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium tracking-widest" dir="ltr">
                    {card.cardNumber}
                  </span>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(card)} className="text-[var(--color-wine)] hover:underline">
                      ویرایش
                    </button>
                    <button onClick={() => handleDelete(card)} className="text-red-600 hover:underline">
                      حذف
                    </button>
                  </div>
                </div>
                {card.shebaNumber && (
                  <p className="text-xs tracking-widest mb-1" dir="ltr">
                    {card.shebaNumber}
                  </p>
                )}
                <p className="text-[var(--color-muted)] text-xs mb-2">
                  {card.holderName}
                  {card.label && ` · ${card.label}`}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(card)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      card.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-[var(--color-linen-dim)] text-[var(--color-muted)]"
                    }`}
                  >
                    {card.isActive ? "فعال" : "غیرفعال"}
                  </button>
                  {card.isDefault ? (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-ochre)] text-[var(--color-ink)]"
                      title="وقتی «تأییدِ اولیه‌ی سفارش» خاموشه، سیستم این کارت رو خودکار تخصیص می‌ده"
                    >
                      کارتِ پیش‌فرض
                    </span>
                  ) : (
                    <button
                      onClick={() => makeDefault(card)}
                      className="text-[10px] text-[var(--color-muted)] hover:underline"
                    >
                      پیش‌فرض کن
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type Transaction = {
  id: string;
  type: "TOPUP" | "PURCHASE" | "REFUND" | "WITHDRAWAL";
  amount: number;
  description: string;
  createdAt: string;
};

type WithdrawalRequest = {
  id: string;
  amount: number;
  cardNumber: string;
  shebaNumber: string | null;
  holderName: string;
  status: "PENDING" | "PAID" | "REJECTED";
  receiptImage: string | null;
  rejectReason: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  TOPUP: "شارژ",
  PURCHASE: "خرید",
  REFUND: "بازگشت وجه",
  WITHDRAWAL: "درخواست واریز",
};

const WITHDRAWAL_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "در حال بررسی", className: "bg-[var(--color-ochre)]/15 text-[var(--color-ochre)]" },
  PAID: { label: "واریز شد", className: "bg-green-100 text-green-700" },
  REJECTED: { label: "رد شد", className: "bg-red-100 text-red-700" },
};

const TOPUP_PRESETS = [100000, 300000, 500000, 1000000];

export default function WalletPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [topping, setTopping] = useState(false);
  const [error, setError] = useState("");

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [wdAmount, setWdAmount] = useState("");
  const [wdCardNumber, setWdCardNumber] = useState("");
  const [wdShebaNumber, setWdShebaNumber] = useState("");
  const [wdHolderName, setWdHolderName] = useState("");
  const [wdSubmitting, setWdSubmitting] = useState(false);
  const [wdError, setWdError] = useState("");

  function load() {
    fetch("/api/wallet")
      .then((res) => res.json())
      .then((data) => {
        setBalance(data.balance);
        setTransactions(data.transactions);
      })
      .finally(() => setLoading(false));
    fetch("/api/wallet/withdrawal-requests")
      .then((res) => res.json())
      .then((data) => setWithdrawals(Array.isArray(data) ? data : []));
  }

  useEffect(load, []);

  async function handleTopup(amount: number) {
    setError("");
    setTopping(true);
    const res = await fetch("/api/wallet/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    setTopping(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در شارژ کیف پول");
      return;
    }
    setCustomAmount("");
    load();
  }

  const hasPendingWithdrawal = withdrawals.some((w) => w.status === "PENDING");

  async function handleWithdrawalSubmit() {
    setWdError("");
    setWdSubmitting(true);
    const res = await fetch("/api/wallet/withdrawal-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(wdAmount),
        cardNumber: wdCardNumber.trim(),
        shebaNumber: wdShebaNumber.trim() || undefined,
        holderName: wdHolderName.trim(),
      }),
    });
    const data = await res.json();
    setWdSubmitting(false);
    if (!res.ok) {
      setWdError(data.error ?? "خطا در ثبت درخواست واریز");
      return;
    }
    setShowWithdrawalForm(false);
    setWdAmount("");
    setWdCardNumber("");
    setWdShebaNumber("");
    setWdHolderName("");
    load();
  }

  if (loading) return <p className="max-w-2xl mx-auto px-4 py-12 text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-xl font-bold mb-6">کیف پول من</h1>

      <div className="border cut-line rounded-lg p-6 bg-white mb-8">
        <p className="text-sm text-[var(--color-muted)] mb-1">موجودی فعلی</p>
        <p className="text-3xl font-extrabold text-[var(--color-wine)]">
          {(balance ?? 0).toLocaleString("fa-IR")} تومان
        </p>
      </div>

      <div className="mb-8">
        <h2 className="font-bold mb-3 text-sm">درخواست واریز موجودی به حساب</h2>

        {withdrawals.length > 0 && (
          <div className="space-y-2 mb-3">
            {withdrawals.map((w) => {
              const badge = WITHDRAWAL_STATUS_LABELS[w.status];
              return (
                <div key={w.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{w.amount.toLocaleString("fa-IR")} تومان</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--color-muted)] mt-1" dir="ltr">
                    {w.cardNumber} — {w.holderName}
                  </p>
                  {w.status === "PAID" && w.receiptImage && (
                    <a
                      href={w.receiptImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--color-wine)] hover:underline mt-1 inline-block"
                    >
                      📷 مشاهده فیش واریزی
                    </a>
                  )}
                  {w.status === "REJECTED" && w.rejectReason && (
                    <p className="text-xs text-red-600 mt-1">دلیل رد: {w.rejectReason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasPendingWithdrawal ? (
          <p className="text-xs text-[var(--color-muted)]">
            درخواست واریز شما در حال بررسی است -- تا مشخص شدن نتیجه، درخواست جدیدی نمی‌توانید ثبت کنید.
          </p>
        ) : showWithdrawalForm ? (
          <div className="border cut-line rounded-lg p-4 bg-white space-y-2">
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">مبلغ (حداکثر {(balance ?? 0).toLocaleString("fa-IR")} تومان)</label>
              <input
                type="number"
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
                placeholder="مبلغ درخواستی"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">شماره کارت</label>
              <input
                value={wdCardNumber}
                onChange={(e) => setWdCardNumber(e.target.value)}
                dir="ltr"
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
                placeholder="۱۶ رقم شماره کارت"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">شماره شبا (اختیاری)</label>
              <input
                value={wdShebaNumber}
                onChange={(e) => setWdShebaNumber(e.target.value)}
                dir="ltr"
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
                placeholder="IR..."
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--color-muted)] block mb-0.5">نام صاحب حساب</label>
              <input
                value={wdHolderName}
                onChange={(e) => setWdHolderName(e.target.value)}
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
                placeholder="نام و نام‌خانوادگی"
              />
            </div>
            {wdError && <p className="text-xs text-red-600">{wdError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleWithdrawalSubmit}
                disabled={
                  wdSubmitting ||
                  !wdAmount ||
                  Number(wdAmount) <= 0 ||
                  Number(wdAmount) > (balance ?? 0) ||
                  !wdCardNumber.trim() ||
                  !wdHolderName.trim()
                }
                className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
              >
                {wdSubmitting ? "..." : "ثبت درخواست"}
              </button>
              <button
                onClick={() => setShowWithdrawalForm(false)}
                disabled={wdSubmitting}
                className="text-sm text-[var(--color-muted)]"
              >
                انصراف
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setWdAmount(String(balance ?? 0));
              setShowWithdrawalForm(true);
            }}
            disabled={!balance}
            className="border cut-line rounded-full px-4 py-2 text-sm bg-white hover:border-[var(--color-wine)] disabled:opacity-50"
          >
            درخواست واریز موجودی به کارتم
          </button>
        )}
      </div>

      <div className="mb-8">
        <h2 className="font-bold mb-3 text-sm">شارژ کیف پول (شبیه‌سازی پرداخت)</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {TOPUP_PRESETS.map((amount) => (
            <button
              key={amount}
              onClick={() => handleTopup(amount)}
              disabled={topping}
              className="border cut-line rounded-full px-4 py-2 text-sm bg-white hover:border-[var(--color-wine)] disabled:opacity-50"
            >
              {amount.toLocaleString("fa-IR")} تومان
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="مبلغ دلخواه"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="border cut-line rounded-lg px-3 py-2 text-sm bg-white flex-1"
          />
          <button
            onClick={() => customAmount && handleTopup(Number(customAmount))}
            disabled={topping || !customAmount}
            className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
          >
            شارژ
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div>
        <h2 className="font-bold mb-3 text-sm">تاریخچه تراکنش‌ها</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">هنوز تراکنشی ثبت نشده.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex justify-between items-center border cut-line rounded-lg p-3 bg-white text-sm"
              >
                <div>
                  <p className="font-medium">{TYPE_LABELS[tx.type]}</p>
                  <p className="text-[var(--color-muted)] text-xs">{tx.description}</p>
                </div>
                <span
                  className={`font-bold ${
                    tx.type === "PURCHASE" || tx.type === "WITHDRAWAL" ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {tx.type === "PURCHASE" || tx.type === "WITHDRAWAL" ? "−" : "+"}
                  {tx.amount.toLocaleString("fa-IR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

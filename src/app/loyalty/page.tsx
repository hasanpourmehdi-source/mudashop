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
};

type RedeemedRow = {
  id: string;
  code: string;
  initialAmount: number;
  redeemedAt: string;
};

type LoyaltyData = {
  balance: number;
  cashbackPercent: number;
  totalLoyalty: number;
  transactions: { id: string; type: "LOYALTY" | "GIFT_CARD"; amount: number; description: string; createdAt: string }[];
  loyaltyPoints: number;
  tier: { key: string; label: string; bonusPercent: number; freeShipping: boolean };
  pointsToNextTier: number | null;
  allTiers: {
    key: string;
    label: string;
    minPoints: number;
    cashbackPercent: number;
    freeShipping: boolean;
    isCurrent: boolean;
  }[];
};

// صفحه‌ی «کارت هدیه و وفاداری»: خرید/فعال‌سازی کارت هدیه + کسراژ وفاداری
export default function LoyaltyPage() {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [bought, setBought] = useState<GiftCardRow[]>([]);
  const [redeemed, setRedeemed] = useState<RedeemedRow[]>([]);

  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [buying, setBuying] = useState(false);

  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [loyaltyRes, cardsRes] = await Promise.all([
      fetch("/api/loyalty"),
      fetch("/api/gift-cards"),
    ]);
    if (loyaltyRes.ok) setData(await loyaltyRes.json());
    if (cardsRes.ok) {
      const cards = await cardsRes.json();
      setBought(cards.bought);
      setRedeemed(cards.redeemed);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function buy() {
    setError("");
    setNotice("");
    const targetPrice = Number(amount);
    if (!Number.isFinite(targetPrice) || targetPrice < 10_000) {
      setError("حداقل مبلغ کارت هدیه ۱۰٬۰۰۰ تومان است");
      return;
    }
    setBuying(true);
    const res = await fetch("/api/gift-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: targetPrice,
        message: message || null,
        recipientEmail: recipientEmail || null,
      }),
    });
    const body = await res.json();
    setBuying(false);
    if (!res.ok) {
      setError(body.error ?? "خطا در خرید کارت هدیه");
      return;
    }
    setNotice(`کارت هدیه با کد ${body.card.code} ساخته شد — کد را برای گیرنده بفرست.`);
    setAmount("");
    setMessage("");
    setRecipientEmail("");
    load();
  }

  async function redeem() {
    setError("");
    setNotice("");
    if (code.trim().length < 6) {
      setError("کد وارد شده معتبر نیست");
      return;
    }
    setRedeeming(true);
    const res = await fetch("/api/gift-cards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json();
    setRedeeming(false);
    if (!res.ok) {
      setError(body.error ?? "کد نامعتبر است");
      return;
    }
    setNotice(body.message);
    setCode("");
    load();
  }

  const fmt = (n: number) => n.toLocaleString("fa-IR");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-10">
      <header>
        <h1 className="text-2xl font-bold">🏆 باشگاه مشتریان</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          هرچی بیشتر خرید کنی، سطحت بالاتر می‌ره و کسراژ و مزایای بیشتری می‌گیری. کارت هدیه هم می‌تونی
          بخری/هدیه بدی، یا کدی که گرفتی را فعال کنی.
        </p>
      </header>

      {notice && <p className="bg-emerald-50 text-emerald-800 border cut-line rounded-lg px-4 py-3 text-sm">{notice}</p>}
      {error && <p className="bg-red-50 text-red-700 border cut-line rounded-lg px-4 py-3 text-sm">{error}</p>}

      {data && data.allTiers.length > 0 && (
        <section className="border cut-line rounded-xl p-5 bg-white space-y-3">
          <h2 className="font-bold">نردبانِ سطوح</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {data.allTiers.map((t) => (
              <div
                key={t.key}
                className={`rounded-lg p-4 border-2 ${
                  t.isCurrent ? "border-[var(--color-wine)] bg-[var(--color-wine)]/5" : "cut-line"
                }`}
              >
                <p className="font-bold flex items-center gap-1.5">
                  {t.key === "GOLD" ? "🥇" : t.key === "SILVER" ? "🥈" : "🥉"} {t.label}
                  {t.isCurrent && (
                    <span className="text-[10px] font-bold text-[var(--color-wine)]">(سطح فعلی تو)</span>
                  )}
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  از {fmt(t.minPoints)} امتیاز
                </p>
                <ul className="text-xs mt-2 space-y-1">
                  <li>💰 {t.cashbackPercent}٪ کسراژ نقدی</li>
                  {t.freeShipping && <li>🚚 ارسال رایگان نامحدود</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {data && (
        <section className="border cut-line rounded-xl p-5 bg-white space-y-2">
          <h2 className="font-bold">وضعیت وفاداری</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="border cut-line rounded-lg p-3">
              <p className="text-xs text-[var(--color-muted)]">مانده‌ی کیف پول</p>
              <p className="font-bold">{fmt(data.balance)} تومان</p>
            </div>
            <div className="border cut-line rounded-lg p-3">
              <p className="text-xs text-[var(--color-muted)]">کل کسراژ دریافتی</p>
              <p className="font-bold">{fmt(data.totalLoyalty)} تومان</p>
            </div>
            <div className="border cut-line rounded-lg p-3">
              <p className="text-xs text-[var(--color-muted)]">نرخ کسراژ (با پاداشِ سطح)</p>
              <p className="font-bold">%{data.cashbackPercent}</p>
            </div>
            <div className="border cut-line rounded-lg p-3">
              <p className="text-xs text-[var(--color-muted)]">سطحِ وفاداری</p>
              <p className="font-bold">
                🏆 {data.tier.label} {data.tier.bonusPercent > 0 && `(+%${data.tier.bonusPercent} کسراژ)`}
              </p>
              {data.tier.freeShipping && <p className="text-[11px] text-emerald-700 mt-0.5">🚚 ارسال رایگان فعاله</p>}
            </div>
            <div className="border cut-line rounded-lg p-3">
              <p className="text-xs text-[var(--color-muted)]">امتیازِ وفاداری</p>
              <p className="font-bold">{fmt(data.loyaltyPoints)}</p>
            </div>
            {data.pointsToNextTier != null && (
              <div className="border cut-line rounded-lg p-3">
                <p className="text-xs text-[var(--color-muted)]">تا سطحِ بعدی</p>
                <p className="font-bold">{fmt(data.pointsToNextTier)} امتیاز</p>
              </div>
            )}
          </div>
          {(() => {
            const currentIdx = data.allTiers.findIndex((t) => t.isCurrent);
            const current = data.allTiers[currentIdx];
            const next = data.allTiers[currentIdx + 1];
            if (!current) return null;
            const rangeStart = current.minPoints;
            const pct = next
              ? Math.min(
                  100,
                  Math.max(0, ((data.loyaltyPoints - rangeStart) / (next.minPoints - rangeStart)) * 100)
                )
              : 100;
            return (
              <div>
                <div className="flex justify-between text-[11px] text-[var(--color-muted)] mb-1">
                  <span>
                    {current.key === "GOLD" ? "🥇" : current.key === "SILVER" ? "🥈" : "🥉"} {current.label}
                  </span>
                  <span>{next ? `${next.key === "GOLD" ? "🥇" : "🥈"} ${next.label}` : "بالاترین سطح 🎉"}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-linen-dim)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-wine)] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}
          {data.transactions.length > 0 && (
            <ul className="text-sm divide-y divide-[var(--color-linen-dim)]">
              {data.transactions.slice(0, 10).map((t) => (
                <li key={t.id} className="py-2 flex justify-between gap-3">
                  <span className="text-[var(--color-muted)] text-xs">{t.description}</span>
                  <span className="font-medium text-emerald-700 whitespace-nowrap">+{fmt(t.amount)} تومان</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="border cut-line rounded-xl p-5 bg-white space-y-3">
        <h2 className="font-bold">خرید کارت هدیه</h2>
        <p className="text-xs text-[var(--color-muted)]">
          مبلغ از کیف پولت کسر می‌شود. بعد از خرید، کد کارت را برای هرکسی که
          خواستی بفرست — او با وارد کردن کد، موجودی را به کیف پول خودش می‌برد.
        </p>
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
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="ایمیل گیرنده (اختیاری)"
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="پیام روی کارت (اختیاری)"
          maxLength={200}
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={buy}
          disabled={buying}
          className="bg-[var(--color-wine)] text-white rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          {buying ? "..." : "خرید کارت هدیه"}
        </button>
      </section>

      <section className="border cut-line rounded-xl p-5 bg-white space-y-3">
        <h2 className="font-bold">فعال‌سازی کارت هدیه</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="مثلاً MUD-7K2M-9QX1"
            className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm uppercase min-w-0"
            dir="ltr"
          />
          <button
            onClick={redeem}
            disabled={redeeming}
            className="bg-[var(--color-wine)] text-white rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            {redeeming ? "..." : "فعال‌سازی"}
          </button>
        </div>
        {redeemed.length > 0 && (
          <ul className="text-sm divide-y divide-[var(--color-linen-dim)]">
            {redeemed.map((r) => (
              <li key={r.id} className="py-2 flex justify-between gap-3">
                <span className="text-xs text-[var(--color-muted)]">
                  فعال‌سازی کد {r.code} در {new Date(r.redeemedAt).toLocaleDateString("fa-IR")}
                </span>
                <span className="font-medium text-emerald-700 whitespace-nowrap">+{fmt(r.initialAmount)} تومان</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border cut-line rounded-xl p-5 bg-white space-y-3">
        <h2 className="font-bold">کارت‌های هدیه‌ای که خریده‌ام</h2>
        {bought.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">هنوز کارت هدیه‌ای نخری‌دی.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {bought.map((c) => (
              <li key={c.id} className="border cut-line rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs" dir="ltr">{c.code}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    {c.message || c.recipientEmail ? `${c.message ?? ""}${c.recipientEmail ? " — " + c.recipientEmail : ""}` : "بدون پیام"}
                  </p>
                </div>
                <div className="text-left">
                  <p className="font-bold">{fmt(c.initialAmount)} تومان</p>
                  <p className={`text-[11px] ${c.redeemedAt ? "text-emerald-700" : "text-amber-700"}`}>
                    {c.redeemedAt ? "فعال شده" : c.isActive ? "در انتظار فعال‌سازی" : "غیرفعال"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
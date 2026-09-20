"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ویجت «قیمتِ مناسب‌تر پیدا کردم» -- صرفاً یه کانالِ ارتباطیِ دستیِ مشتری->ادمین
// (بدونِ هیچ مقایسه/اسکرپِ خودکار). گزارش می‌ره توی صفِ ادمین (/admin/price-reports)
export function PriceReportWidget({
  productId,
  externalId,
  currentPrice,
}: {
  productId?: string;
  externalId?: string;
  currentPrice: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reportedPrice, setReportedPrice] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    const price = Number(reportedPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("قیمت معتبر وارد کنید");
      return;
    }
    setError("");
    setSaving(true);
    const res = await fetch("/api/price-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, externalId, reportedPrice: price, note: note.trim() || undefined }),
    });
    setSaving(false);
    if (res.status === 401) {
      router.push("/auth/login");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ثبتِ گزارش");
      return;
    }
    setSent(true);
    setOpen(false);
  }

  if (sent) {
    return (
      <div className="mt-3 border cut-line rounded-lg p-3 bg-white text-xs text-emerald-700">
        ممنون! گزارشت برای بررسی به تیمِ ما ارسال شد.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 border cut-line rounded-lg p-3 bg-white text-xs font-medium w-full text-right hover:border-[var(--color-wine)]"
      >
        💰 این کالا رو جای دیگه ارزون‌تر دیدید؟
      </button>
    );
  }

  return (
    <div className="mt-3 border cut-line rounded-lg p-3 bg-white text-sm space-y-2">
      <p className="text-xs font-medium">💰 قیمتِ مناسب‌تر پیدا کردید؟</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={reportedPrice}
          onChange={(e) => setReportedPrice(e.target.value)}
          placeholder={`قیمتی که دیدید (فعلی: ${currentPrice.toLocaleString("fa-IR")})`}
          className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm min-w-0"
        />
        <span className="text-[11px] text-[var(--color-muted)] whitespace-nowrap">تومان</span>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="توضیح یا لینک (اختیاری)"
        className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="bg-[var(--color-wine)] text-white rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {saving ? "..." : "ثبتِ گزارش"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="text-xs text-[var(--color-muted)] px-2"
        >
          انصراف
        </button>
      </div>
    </div>
  );
}

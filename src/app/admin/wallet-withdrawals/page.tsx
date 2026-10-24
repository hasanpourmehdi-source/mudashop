"use client";

import { prepareUpload, appendUpload, discardPrepared } from "@/lib/directUpload";
import { useEffect, useRef, useState } from "react";

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
  user: { name: string | null; email: string };
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "در حال بررسی", className: "bg-[var(--color-ochre)]/15 text-[var(--color-ochre)]" },
  PAID: { label: "واریز شد", className: "bg-green-100 text-green-700" },
  REJECTED: { label: "رد شد", className: "bg-red-100 text-red-700" },
};

function WithdrawalRow({ req, onDone }: { req: WithdrawalRequest; onDone: () => void }) {
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submitApprove() {
    if (!file) return;
    setError("");
    setLoading(true);
    const formData = new FormData();
    formData.append("action", "approve");
    let prepared: Awaited<ReturnType<typeof prepareUpload>> | null = null;
    try {
      prepared = await prepareUpload(file, "withdrawal-receipt");
      appendUpload(formData, prepared);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "خطا در آپلود فیش");
      return;
    }
    const res = await fetch(`/api/admin/wallet-withdrawals/${req.id}`, { method: "POST", body: formData });
    setLoading(false);
    if (!res.ok) {
      discardPrepared(prepared);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در تکمیل درخواست");
      return;
    }
    onDone();
  }

  async function submitReject() {
    setError("");
    setLoading(true);
    const formData = new FormData();
    formData.append("action", "reject");
    formData.append("reason", reason.trim());
    const res = await fetch(`/api/admin/wallet-withdrawals/${req.id}`, { method: "POST", body: formData });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در رد درخواست");
      return;
    }
    onDone();
  }

  const badge = STATUS_BADGE[req.status];

  return (
    <div className="border cut-line rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{req.user.name ?? req.user.email}</p>
          <p className="text-[10px] text-[var(--color-muted)]">{req.user.email}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <p className="text-lg font-bold text-[var(--color-wine)] mt-2">{req.amount.toLocaleString("fa-IR")} تومان</p>
      <p className="text-xs text-[var(--color-muted)] mt-1" dir="ltr">
        {req.cardNumber} {req.shebaNumber && `— ${req.shebaNumber}`}
      </p>
      <p className="text-xs text-[var(--color-muted)]">به نام {req.holderName}</p>

      {req.status === "PAID" && req.receiptImage && (
        <a href={req.receiptImage} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-wine)] hover:underline mt-2 inline-block">
          📷 مشاهده فیش واریزی
        </a>
      )}
      {req.status === "REJECTED" && req.rejectReason && (
        <p className="text-xs text-red-600 mt-2">دلیل رد: {req.rejectReason}</p>
      )}

      {req.status === "PENDING" && (
        <div className="mt-3">
          {mode === "approve" ? (
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full border-2 border-dashed cut-line rounded-lg py-3 text-xs text-[var(--color-muted)] hover:bg-[var(--color-linen-dim)]"
              >
                {file ? `📷 ${file.name}` : "📷 انتخاب عکس فیش واریزی"}
              </button>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={submitApprove}
                  disabled={loading || !file}
                  className="bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                >
                  {loading ? "..." : "تأیید واریز"}
                </button>
                <button onClick={() => setMode(null)} className="text-xs text-[var(--color-muted)]">انصراف</button>
              </div>
            </div>
          ) : mode === "reject" ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full border cut-line rounded-lg px-2 py-1.5 text-xs"
                placeholder="دلیل رد (مثلاً شماره کارت نامعتبر بود)"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={submitReject}
                  disabled={loading || !reason.trim()}
                  className="bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                >
                  {loading ? "..." : "تأیید رد (بازگشت به کیف پول)"}
                </button>
                <button onClick={() => setMode(null)} className="text-xs text-[var(--color-muted)]">انصراف</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setMode("approve")}
                className="border cut-line px-3 py-1.5 rounded-full text-xs font-medium hover:border-[var(--color-wine)]"
              >
                واریز شد
              </button>
              <button onClick={() => setMode("reject")} className="text-xs text-red-600">
                رد کردن
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WalletWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/admin/wallet-withdrawals")
      .then((res) => res.json())
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">درخواست‌های واریز کیف پول</h1>
      {requests.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">هیچ درخواستی ثبت نشده.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <WithdrawalRow key={req.id} req={req} onDone={load} />
          ))}
        </div>
      )}
    </div>
  );
}

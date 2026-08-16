"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "کالای معیوب",
  WRONG_ITEM: "ارسال کالای اشتباه",
  WRONG_SIZE: "سایز/مشخصات نامناسب",
  CHANGED_MIND: "انصراف بدون دلیل خاص",
  OTHER: "سایر",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأیید شده — منتظر ارسال کالا",
  REJECTED: "رد شده",
  ITEM_RECEIVED: "کالا دریافت شد",
  REFUNDED: "وجه به کیف پول بازگشت داده شد",
};

const STATUS_OPTIONS = ["PENDING", "APPROVED", "REJECTED", "ITEM_RECEIVED", "REFUNDED"];

type ReturnRequestData = {
  id: string;
  status: string;
  refundAmount: number;
  createdAt: string;
  items: { orderItemId: string; reason: string; description: string | null }[];
};

export function AdminReturnRequestPanel({
  returnRequest,
  orderItemTitles,
}: {
  returnRequest: ReturnRequestData;
  orderItemTitles: Record<string, string>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(status: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/returns/${returnRequest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در به‌روزرسانی");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mb-8 border cut-line rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm">درخواست مرجوعی مشتری</h2>
        <select
          value={returnRequest.status}
          onChange={(e) => updateStatus(e.target.value)}
          disabled={saving || returnRequest.status === "REFUNDED"}
          className="border cut-line rounded-lg px-2 py-1 text-xs bg-white disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 mb-3">
        {returnRequest.items.map((item) => (
          <div key={item.orderItemId} className="text-xs border-b cut-line pb-2 last:border-0 last:pb-0">
            <p className="font-medium">{orderItemTitles[item.orderItemId] ?? "کالا"}</p>
            <p className="text-[var(--color-muted)]">دلیل: {REASON_LABELS[item.reason] ?? item.reason}</p>
            {item.description && <p className="text-[var(--color-muted)]">«{item.description}»</p>}
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <p className="text-xs text-[var(--color-muted)]">
        ثبت‌شده در {new Date(returnRequest.createdAt).toLocaleString("fa-IR")}
      </p>
      <p className="text-sm font-bold text-[var(--color-wine)] mt-1">
        مبلغ قابل بازگشت: {returnRequest.refundAmount.toLocaleString("fa-IR")} تومان
      </p>
    </section>
  );
}

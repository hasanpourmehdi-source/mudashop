"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canCustomerCancelOrder } from "@/lib/orderCancellation";
import { Spinner } from "@/components/Spinner";

export function CancelOrderButton({
  orderId,
  status,
  hasExternalItems,
  paymentStatus,
  itemPurchaseStatuses = [],
}: {
  orderId: string;
  status: string;
  hasExternalItems: boolean;
  paymentStatus: string;
  itemPurchaseStatuses?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // همین قانونی که سرور موقع PATCH اجرا می‌کنه، اینجا هم برای نمایش/عدم نمایش
  // دکمه استفاده می‌شه (یه منبع واحد -- نه دوباره‌سازی جدا)؛ پس UI و API هیچ
  // وقت از هم جدا نمی‌شن. این دکمه فقط برای لغو مستقیمِ سفارش مزونه؛ سفارش‌های
  // خارجی از دکمه‌ی CancelRequestButton (درخواست با تأیید ادمین) استفاده می‌کنن.
  const policy = canCustomerCancelOrder({
    hasExternalItems,
    paymentStatus,
    status,
    itemPurchaseStatuses,
  });
  if (policy.mode !== "direct") return null;

  async function handleCancel() {
    if (!reason.trim()) {
      setError("لطفاً دلیل لغو را بنویسید");
      return;
    }
    setError("");
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason: reason.trim() }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else {
      const data = await res.json();
      setError(data.error ?? "خطا در لغو سفارش");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-red-600 hover:underline">
        لغو سفارش
      </button>
    );
  }

  return (
    <div className="border cut-line rounded-lg p-3 bg-white space-y-2">
      <p className="text-sm font-bold text-red-600">لغو سفارش</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="دلیل لغو را بنویسید..."
        rows={2}
        className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCancel}
          disabled={loading}
          className="text-sm inline-flex items-center justify-center gap-1.5 bg-red-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
        >
          {loading && <Spinner className="w-3.5 h-3.5" />}
          {loading ? "در حال لغو..." : "تأیید لغو سفارش"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setReason("");
            setError("");
          }}
          disabled={loading}
          className="text-sm text-[var(--color-muted)] hover:underline disabled:opacity-50"
        >
          انصراف
        </button>
      </div>
    </div>
  );
}

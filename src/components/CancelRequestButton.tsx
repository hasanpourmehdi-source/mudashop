"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canCustomerCancelOrder } from "@/lib/orderCancellation";
import { Spinner } from "@/components/Spinner";

// برای سفارش‌های حاوی کالای خارجی: مشتری نمی‌تونه مستقیم لغو کنه -- فقط یه
// «درخواست لغو» ثبت می‌کنه که ادمین باید تأیید یا ردش کنه. این کامپوننت
// دکمه/فرم ثبت درخواست + وضعیت درخواستِ جاری (در انتظار بررسی / رد شده) رو
// نشون می‌ده. فقط وقتی policy.mode === "request" رندر می‌شه.
export function CancelRequestButton({
  orderId,
  status,
  hasExternalItems,
  paymentStatus,
  itemPurchaseStatuses = [],
  existingRequest,
}: {
  orderId: string;
  status: string;
  hasExternalItems: boolean;
  paymentStatus: string;
  itemPurchaseStatuses?: string[];
  existingRequest?: { id: string; status: string; reason: string; adminNote: string | null } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const policy = canCustomerCancelOrder({
    hasExternalItems,
    paymentStatus,
    status,
    itemPurchaseStatuses,
  });
  if (policy.mode !== "request") return null;

  if (existingRequest?.status === "PENDING") {
    return (
      <div className="border cut-line rounded-lg p-3 bg-white text-sm">
        <p className="font-bold text-amber-700">درخواست لغو ثبت شده — در انتظار بررسی</p>
        <p className="text-[var(--color-muted)] mt-1">
          دلیل: {existingRequest.reason} — به‌محض بررسی ادمین به شما اطلاع داده می‌شود.
        </p>
      </div>
    );
  }

  if (existingRequest?.status === "REJECTED") {
    return (
      <div className="border cut-line rounded-lg p-3 bg-white text-sm space-y-2">
        <p className="font-bold text-red-600">درخواست لغو رد شد</p>
        {existingRequest.adminNote && (
          <p className="text-[var(--color-muted)]">پیام ادمین: {existingRequest.adminNote}</p>
        )}
        <button onClick={() => setOpen(true)} className="text-sm text-red-600 hover:underline">
          ثبت درخواست جدید
        </button>
      </div>
    );
  }

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("لطفاً دلیل لغو را بنویسید");
      return;
    }
    setError("");
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/cancel-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else {
      const data = await res.json();
      setError(data.error ?? "خطا در ثبت درخواست لغو");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-red-600 hover:underline">
        درخواست لغو سفارش
      </button>
    );
  }

  return (
    <div className="border cut-line rounded-lg p-3 bg-white space-y-2">
      <p className="text-sm font-bold text-red-600">درخواست لغو سفارش</p>
      <p className="text-xs text-[var(--color-muted)]">
        این سفارش کالای خارجی دارد؛ لغو پس از تأیید ادمین انجام می‌شود.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="دلیل درخواست لغو را بنویسید..."
        rows={2}
        className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="text-sm inline-flex items-center justify-center gap-1.5 bg-red-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
        >
          {loading && <Spinner className="w-3.5 h-3.5" />}
          {loading ? "در حال ثبت..." : "ثبت درخواست لغو"}
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
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// پنل تصمیم‌گیری ادمین روی درخواست لغو سفارش خارجی. وقتی درخواست PENDING باشه،
// ادمین می‌تونه تأیید (لغو کامل + بازگشت منابع) یا رد (سفارش دست‌نخورده) کنه.
// برای حالت رد، یه پیام اختیاری می‌تونه بده که به مشتری نمایش داده می‌شه.
const SHIPPED_LIKE_STATUSES = new Set(["SHIPPED", "DELIVERED", "RETURNED"]);
const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پردازش",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

export function AdminCancellationRequestPanel({
  orderId,
  orderStatus,
  cancellationRequest,
}: {
  orderId: string;
  orderStatus: string;
  cancellationRequest: {
    id: string;
    status: string;
    reason: string;
    adminNote: string | null;
    createdAt: string;
  };
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const alreadyShipped = SHIPPED_LIKE_STATUSES.has(orderStatus);

  if (cancellationRequest.status !== "PENDING") {
    return (
      <section className="mb-8 border cut-line rounded-lg p-4 bg-white text-sm space-y-1">
        <h2 className="font-bold mb-2">درخواست لغو سفارش</h2>
        <p className="text-xs text-[var(--color-muted)]">
          دلیل مشتری: {cancellationRequest.reason} —{" "}
          {new Date(cancellationRequest.createdAt).toLocaleString("fa-IR")}
        </p>
        <p
          className={`text-xs font-bold ${
            cancellationRequest.status === "APPROVED" ? "text-green-700" : "text-red-600"
          }`}
        >
          {cancellationRequest.status === "APPROVED" ? "تأیید شده — سفارش لغو شد" : "رد شده"}
        </p>
        {cancellationRequest.adminNote && (
          <p className="text-xs text-[var(--color-muted)]">پیام شما: {cancellationRequest.adminNote}</p>
        )}
      </section>
    );
  }

  async function handle(action: "approve" | "reject") {
    setError("");
    setLoading(action);
    const res = await fetch(`/api/admin/orders/${orderId}/cancel-request`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminNote: note.trim() || undefined }),
    });
    setLoading(null);
    if (res.ok) router.refresh();
    else {
      const data = await res.json();
      setError(data.error ?? "خطا در ثبت تصمیم");
    }
  }

  return (
    <section className="mb-8 border cut-line rounded-lg p-4 bg-white text-sm space-y-2">
      <h2 className="font-bold">درخواست لغو سفارش</h2>
      <p className="text-xs text-[var(--color-muted)]">
        وضعیت فعلی سفارش:{" "}
        <span className="font-bold">{ORDER_STATUS_LABELS[orderStatus] ?? orderStatus}</span>
      </p>
      {alreadyShipped && (
        <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-300 rounded-lg p-2">
          ⚠️ این سفارش قبلاً ارسال/تحویل شده. احتمالاً کالا دستِ مشتریه -- تأیید این درخواست دیگه
          امکان‌پذیر نیست (سرور جلوش رو می‌گیره)؛ اگه مشتری واقعاً پشیمونه، از مسیر مرجوعی استفاده کنید.
        </p>
      )}
      <p className="text-xs text-[var(--color-muted)]">
        مشتری درخواست لغو این سفارش را داده است: {cancellationRequest.reason} —{" "}
        {new Date(cancellationRequest.createdAt).toLocaleString("fa-IR")}
      </p>
      <p className="text-xs text-[var(--color-muted)]">
        تأیید = لغو کامل سفارش + بازگشت موجودی/کوپن/کیف پول (در صورت پرداخت کارت‌به‌کارت، وجه را دستی
        برگردانید). رد = سفارش دست‌نخورده می‌ماند.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="پیام به مشتری (اختیاری)..."
        rows={2}
        className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handle("approve")}
          disabled={loading !== null || alreadyShipped}
          title={alreadyShipped ? "سفارش ارسال/تحویل شده -- قابل تأیید نیست" : undefined}
          className="text-sm bg-green-700 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
        >
          {loading === "approve" ? "در حال تأیید..." : "تأیید و لغو سفارش"}
        </button>
        <button
          onClick={() => handle("reject")}
          disabled={loading !== null}
          className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
        >
          {loading === "reject" ? "در حال رد..." : "رد درخواست"}
        </button>
      </div>
    </section>
  );
}
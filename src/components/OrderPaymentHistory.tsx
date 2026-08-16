type PaymentEvent = {
  id: string;
  round: string;
  purpose: string;
  amount: number;
  cardNumber: string | null;
  cardHolder: string | null;
  shebaNumber: string | null;
  assignedAt: string;
  paidAt: string | null;
};

// چون هر بار ممکنه شماره کارت متفاوتی برای پرداخت به مشتری داده بشه (مثلاً
// دور دوم بعد از رد یه فیش با کارت دیگه دوباره تخصیص داده می‌شه)، اینجا تاریخچه‌ی
// کامل هر تخصیص رو نشون می‌دیم -- نه فقط آخرین کارت فعلی روی سفارش
export function OrderPaymentHistory({ events }: { events: PaymentEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="mb-8 border cut-line rounded-lg p-4 bg-white">
      <h2 className="font-bold mb-3 text-sm">تاریخچه‌ی پرداخت و تخصیص کارت</h2>
      <div className="space-y-3">
        {events.map((ev) => (
          <div key={ev.id} className="border-b cut-line pb-3 last:border-0 last:pb-0 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{ev.purpose}</span>
              <span className="font-bold text-[var(--color-wine)]">
                {ev.amount.toLocaleString("fa-IR")} تومان
              </span>
            </div>
            {ev.cardNumber && (
              <p className="text-xs text-[var(--color-muted)]" dir="ltr">
                {ev.cardNumber} — {ev.cardHolder}
                {ev.shebaNumber && ` — شبا: ${ev.shebaNumber}`}
              </p>
            )}
            <p className="text-xs text-[var(--color-muted)] mt-1">
              تخصیص در {new Date(ev.assignedAt).toLocaleString("fa-IR")}
              {ev.paidAt ? (
                <span className="text-green-700"> — پرداخت‌شده در {new Date(ev.paidAt).toLocaleString("fa-IR")}</span>
              ) : (
                <span> — در انتظار پرداخت/تأیید</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

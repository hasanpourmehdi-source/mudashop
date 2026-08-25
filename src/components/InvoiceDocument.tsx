// بدنه‌ی مشترک فاکتور/پیش‌فاکتور — هم در صفحه‌ی مستقل `/orders/[id]/invoice`
// و هم در مودال‌های سفارش و سبد خرید استفاده می‌شود. بدون state و window تا
// هم در سرور (صفحه‌ی مستقل) و هم در کلاینت (مودال‌ها) قابل استفاده باشد.

import { PURCHASE_OUTCOME_LABELS } from "@/lib/orderPurchaseStatus";

// فقط وضعیت‌های «مشکل‌دار» (که پولش رفاند شده) اینجا لازمه -- RECEIVED که یعنی
// همه‌چی مرتبه، نباید نشونه‌ی خاصی توی فاکتور بگیره. CANCELLED مالِ فازِ اول
// (ادمین اصلاً نتونست بخره) هست و توی PURCHASE_OUTCOME_LABELS (فازِ دوم) نیست
const ITEM_ISSUE_LABELS: Record<string, string> = {
  CANCELLED: "لغو شد",
  LOST: PURCHASE_OUTCOME_LABELS.LOST,
  WRONG_SIZE: PURCHASE_OUTCOME_LABELS.WRONG_SIZE,
  WRONG_COLOR: PURCHASE_OUTCOME_LABELS.WRONG_COLOR,
  ISSUE_OTHER: PURCHASE_OUTCOME_LABELS.ISSUE_OTHER,
};

export type InvoiceLine = {
  id: string;
  title: string;
  quantity: number;
  price: number;
  source: "MAZON" | "TRENDYOL";
  sourceUrl?: string | null;
  // اگه لینک اصلی مشکل داشت/ناموجود بود و ادمین یه لینک جایگزین (تامین‌کننده‌ی
  // دیگه) برای همین قلم ثبت کرده باشه؛ کاملاً داخلی/فقط-ادمین
  secondarySourceUrl?: string | null;
  variantLabel?: string | null;
  // اگه این قلم لغو شده (ادمین نتونست بخره) یا بعد از خرید مغایرت داشته (گم‌شد/
  // سایز‌اشتباه/رنگ‌اشتباه/دلخواه)، وضعیت + دلیل همین‌جا نشون داده می‌شه؛ پول
  // این قلم قبلاً رفاند شده، ولی برای شفافیت توی سند رسمی باید مشخص باشه
  purchaseStatus?: string | null;
  purchaseNote?: string | null;
};

export type InvoiceDocumentProps = {
  kind: "invoice" | "proforma";
  invoiceNo: string;
  issueDate: string;
  issueDateLong: string;
  dueLabel: string;
  dueDate?: string;
  sellerName: string;
  sellerTagline: string;
  buyer: {
    name: string;
    title?: string;
    province: string;
    city: string;
    detail: string;
    postalCode?: string;
    phone: string;
  };
  items: InvoiceLine[];
  subtotal: number;
  discountTotal: number;
  couponCode: string | null;
  shippingCost: number | null;
  cargoCost: number | null;
  walletUsed: number;
  // دور دوم (هزینه ارسال/باربری سفارش خارجی) هم می‌تونه بخشی یا کامل از کیف
  // پول کسر شده باشه -- جدا از walletUsedِ دور اول (قیمت خودِ اقلام)
  shippingWalletOffset?: number;
  total: number;
  hasExternalItems: boolean;
  statusLabel: string;
  paymentStatusLabel: string;
  shippingMethod: string | null;
  trackingCode: string | null;
  isAdmin?: boolean;
};

const fa = (n: number) => n.toLocaleString("fa-IR");

export function InvoiceDocument({ data }: { data: InvoiceDocumentProps }) {
  const isPaid = data.kind === "invoice";

  return (
    <div className="text-sm space-y-4 print:text-[11px]">
      {/* سربرگ */}
      <div className="flex items-start justify-between border-b cut-line pb-3 print:border-black">
        <div>
          <p className="text-lg font-extrabold text-[var(--color-wine)] print:text-black">
            {data.sellerName}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {isPaid ? "فاکتور فروش رسمی" : "پیش‌فاکتور"}
          </p>
          <p className="text-[11px] text-[var(--color-muted)] mt-1">{data.sellerTagline}</p>
        </div>
        <div className="text-xs text-left space-y-0.5">
          <p>
            <span className="text-[var(--color-muted)]">شماره {isPaid ? "فاکتور" : "پیش‌فاکتور"}: </span>
            <span className="font-bold" dir="ltr">
              {data.invoiceNo}
            </span>
          </p>
          <p>
            <span className="text-[var(--color-muted)]">تاریخ صدور: </span>
            <span>{data.issueDate}</span>
          </p>
          <p className="text-[var(--color-muted)]">{data.issueDateLong}</p>
          {data.dueDate && (
            <p>
              <span className="text-[var(--color-muted)]">{data.dueLabel}: </span>
              <span>{data.dueDate}</span>
            </p>
          )}
        </div>
      </div>

      {/* فرستنده/گیرنده */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-0.5 border cut-line rounded-lg p-3 bg-[var(--color-linen-dim)] print:border-black">
          <p className="font-bold mb-1">فروشنده</p>
          <p>{data.sellerName}</p>
          <p>{data.sellerTagline}</p>
        </div>
        <div className="space-y-0.5 border cut-line rounded-lg p-3 bg-[var(--color-linen-dim)] print:border-black">
          <p className="font-bold mb-1">گیرنده</p>
          <p>
            {data.buyer.name}
            {data.buyer.title ? ` — ${data.buyer.title}` : ""}
          </p>
          <p>
            {data.buyer.province}، {data.buyer.city}
          </p>
          <p>{data.buyer.detail}</p>
          {data.buyer.postalCode && <p>کد پستی: {data.buyer.postalCode}</p>}
          <p>{data.buyer.phone}</p>
        </div>
      </div>

      {/* جدول اقلام */}
      <table className="w-full text-xs print:text-[10px]">
        <thead>
          <tr className="border-b cut-line text-right print:border-black">
            <th className="py-2 font-medium">کالا</th>
            <th className="py-2 font-medium text-center w-16">تعداد</th>
            <th className="py-2 font-medium text-left w-28">قیمت واحد</th>
            <th className="py-2 font-medium text-left w-32">جمع</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => {
            const issueLabel = item.purchaseStatus ? ITEM_ISSUE_LABELS[item.purchaseStatus] : undefined;
            return (
            <tr key={item.id} className="border-b cut-line print:border-black">
              <td className="py-2">
                <span className={issueLabel ? "line-through text-[var(--color-muted)]" : undefined}>
                  {item.title}
                </span>
                {issueLabel && (
                  <span className="inline-block mr-1.5 text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full print:border print:border-black print:text-black print:bg-white">
                    {issueLabel}
                  </span>
                )}
                {issueLabel && item.purchaseNote && (
                  <span className="block text-[10px] text-[var(--color-muted)]">دلیل: {item.purchaseNote}</span>
                )}
                {item.variantLabel && (
                  <span className="block text-[10px] text-[var(--color-muted)]">{item.variantLabel}</span>
                )}
                {data.isAdmin && item.source === "TRENDYOL" && item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[10px] text-[var(--color-wine)] hover:underline print:hidden"
                  >
                    🔗 مشاهده در سایت اصلی
                  </a>
                )}
                {data.isAdmin && item.source === "TRENDYOL" && item.secondarySourceUrl && (
                  <a
                    href={item.secondarySourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[10px] text-[var(--color-ochre)] hover:underline print:hidden"
                  >
                    🔗 لینک اصلی ۲ (فقط ادمین)
                  </a>
                )}
              </td>
              <td className="py-2 text-center">{fa(item.quantity)}</td>
              <td className="py-2 text-left">{fa(item.price)}</td>
              <td className="py-2 text-left font-medium">
                {fa(item.price * item.quantity)} تومان
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>

      {/* جمع‌بندی مبلغ */}
      <div className="flex justify-end">
        <div className="w-72 space-y-1 text-xs print:text-[10px]">
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">جمع اقلام</span>
            <span>{fa(data.subtotal)} تومان</span>
          </div>
          {data.discountTotal > 0 && (
            <div className="flex justify-between text-green-700 print:text-black">
              <span>تخفیف کوپن {data.couponCode && `(${data.couponCode})`}</span>
              <span>−{fa(data.discountTotal)} تومان</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">هزینه ارسال</span>
            <span>
              {data.shippingCost === null
                ? data.hasExternalItems
                  ? "بعد از وزن‌کشی مشخص می‌شود"
                  : "در انتظار تعیین"
                : data.shippingCost === 0
                ? "رایگان"
                : `${fa(data.shippingCost)} تومان`}
            </span>
          </div>
          {data.cargoCost !== null && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">هزینه باربری</span>
              <span>{fa(data.cargoCost)} تومان</span>
            </div>
          )}
          {!!data.shippingWalletOffset && data.shippingWalletOffset > 0 && (
            <div className="flex justify-between text-green-700 print:text-black">
              <span>کسر از کیف پول (بابت ارسال/باربری)</span>
              <span>−{fa(data.shippingWalletOffset)} تومان</span>
            </div>
          )}
          {data.walletUsed > 0 && (
            <div className="flex justify-between text-green-700 print:text-black">
              <span>پرداخت از کیف پول</span>
              <span>−{fa(data.walletUsed)} تومان</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t cut-line pt-1 print:border-black">
            <span>
              {isPaid ? "مبلغ نهایی" : "مبلغ قابل پرداخت"}
              {data.shippingCost === null && (
                <span className="block text-[10px] font-normal text-[var(--color-muted)]">
                  موقت -- بدون هزینه ارسال
                </span>
              )}
            </span>
            <span className="text-[var(--color-wine)] print:text-black">{fa(data.total)} تومان</span>
          </div>
        </div>
      </div>

      {/* وضعیت */}
      <div className="flex items-center justify-between text-xs border-t cut-line pt-3 print:border-black">
        <span>
          <span className="text-[var(--color-muted)]">وضعیت سفارش: </span>
          <span className="font-bold">{data.statusLabel}</span>
        </span>
        <span>
          <span className="text-[var(--color-muted)]">وضعیت پرداخت: </span>
          <span className="font-bold">{data.paymentStatusLabel}</span>
        </span>
        {data.shippingMethod && (
          <span>
            <span className="text-[var(--color-muted)]">نحوه ارسال: </span>
            <span>{data.shippingMethod}</span>
          </span>
        )}
      </div>

      {data.trackingCode && (
        <p className="text-xs text-[var(--color-muted)]">
          کد رهگیری: <span dir="ltr">{data.trackingCode}</span>
        </p>
      )}

      {!isPaid && (
        <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">
          این سند یک پیش‌فاکتور است و تا زمان پرداخت، سند رسمی فروش محسوب نمی‌شود.
        </p>
      )}
    </div>
  );
}
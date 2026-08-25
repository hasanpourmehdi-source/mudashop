"use client";

import Link from "next/link";

// دکمه‌ی «مشاهده و چاپ فاکتور» -- مستقیم به نسخه‌ی مستقل و چاپ‌پذیرِ فاکتور
// (/orders/[id]/invoice) می‌بره. قبلاً یه مودالِ پیش‌نمایش هم همین‌جا بود، ولی
// چون محتواش دقیقاً با نسخه‌ی مستقل یکی بود، حذف شد تا فقط یک مسیر برای
// دیدن/چاپِ فاکتور بمونه.
export function OrderInvoice({ orderId }: { orderId: string }) {
  return (
    <Link
      href={`/orders/${orderId}/invoice`}
      className="text-sm text-[var(--color-wine)] hover:underline"
    >
      مشاهده و چاپ فاکتور
    </Link>
  );
}

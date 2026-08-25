"use client";

import { useRef, useState } from "react";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintButton } from "@/components/PrintButton";
import { invoiceNumber, formatJalaliDate, formatJalaliLong } from "@/lib/invoice";
import type { CartItem } from "@/store/cart";

// پیش‌فاکتور از سبد خرید پیش از ثبت سفارش (شماره ۳ از شکاف‌های مقایسه).
// چون سبد state کلاینت است (localStorage) و هنوز آدرس/کاربر ثبت نشده، به‌جای
// صفحه‌ی مستقل، مودالِ چاپ‌پذیر در همان صفحه‌ی سبد باز می‌شود؛ بدنه‌ی سند از
// InvoiceDocument مشترک است و خروجی چاپ/PDF آن دقیقاً شبیه فاکتور واقعی است.
export function CartProforma({
  items,
  subtotal,
  discountAmount,
  couponCode,
  currentTotal,
}: {
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  currentTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const proformaIdRef = useRef<string | null>(null);
  if (!proformaIdRef.current) {
    proformaIdRef.current = `CART-${Date.now().toString(36)}-${items
      .map((i) => i.id)
      .join("")
      .slice(-8)}`;
  }

  const now = new Date();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full text-center border cut-line py-3 rounded-full text-sm font-medium bg-white hover:bg-[var(--color-linen-dim)] transition-colors"
      >
        دریافت پیش‌فاکتور
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 print:bg-white print:p-0 print:block print:static print:max-h-none print:overflow-visible">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 print:shadow-none print:rounded-none print:p-0 print:max-w-full">
            <div className="flex items-center justify-between mb-4 print:hidden">
              <h3 className="font-bold">پیش‌فاکتور سبد خرید</h3>
              <div className="flex items-center gap-2">
                <PrintButton />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  aria-label="بستن"
                >
                  ✕
                </button>
              </div>
            </div>

            <InvoiceDocument
              data={{
                kind: "proforma",
                invoiceNo: invoiceNumber({ orderId: proformaIdRef.current, kind: "proforma", date: now }),
                issueDate: formatJalaliDate(now),
                issueDateLong: formatJalaliLong(now),
                dueLabel: "اعتبار پیش‌فاکتور",
                dueDate: undefined,
                sellerName: "مُداشاپ",
                sellerTagline: "فروشگاه مزون و کالای خارجی",
                buyer: {
                  name: "—",
                  province: "—",
                  city: "—",
                  detail: "پس از ثبت سفارش، مشخصات گیرنده در فاکتور نهایی درج می‌شود",
                  phone: "—",
                },
                items: items.map((item) => ({
                  id: item.id,
                  title: item.title,
                  quantity: item.quantity,
                  price: item.price,
                  source: item.source,
                  variantLabel: item.variantLabel,
                })),
                subtotal,
                discountTotal: discountAmount,
                couponCode,
                shippingCost: null,
                cargoCost: null,
                walletUsed: 0,
                total: currentTotal,
                hasExternalItems: items.some((i) => i.source === "TRENDYOL"),
                statusLabel: "سبد باز",
                paymentStatusLabel: "پرداخت نشده",
                shippingMethod: null,
                trackingCode: null,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintButton } from "@/components/PrintButton";
import {
  invoiceNumber,
  isProforma,
  formatJalaliDate,
  formatJalaliLong,
  paymentStatusLabel,
} from "@/lib/invoice";
import { customerOrderStatusLabel } from "@/lib/orderStatusMessages";
import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";

export const metadata: Metadata = {
  title: "فاکتور سفارش",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پردازش",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, shippingPayment: true },
  });

  if (!order || (order.userId !== session.user.id && session.user.role !== "ADMIN")) {
    notFound();
  }

  const kind = isProforma(order.paymentStatus) ? "proforma" : "invoice";
  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");
  const isAdmin = session.user.role === "ADMIN";

  // برای ادمین: لینک اصلی محصول (از کشِ contentId) کنار هر قلمِ ترندیول توی
  // فاکتور نشون داده می‌شه تا در صورت نیاز به بررسی دستی، مستقیم به سایتِ اصلی
  // برسه -- برای مشتری هیچ‌وقت نمایش داده نمی‌شه (isAdmin در InvoiceDocument)
  const sourceUrlByItemId = new Map<string, string | null>();
  if (isAdmin) {
    await Promise.all(
      order.items
        .filter((i) => i.source === "TRENDYOL" && i.externalId)
        .map(async (i) => {
          sourceUrlByItemId.set(i.id, await getCachedTrendyolProductUrl(i.externalId!));
        })
    );
  }

  const addressSnapshot = JSON.parse(order.addressSnapshot) as {
    title: string;
    fullName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    detail: string;
  };

  const issuedAt = order.paidAt ?? order.createdAt;
  const orderNo = order.id.slice(-8);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 no-print">
        <Link
          href={`/orders/${order.id}`}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-wine)]"
        >
          → بازگشت به سفارش #{orderNo}
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white rounded-2xl border cut-line p-6 shadow-sm print:shadow-none print:border-none print:p-0">
        <InvoiceDocument
          data={{
            kind,
            invoiceNo: invoiceNumber({ orderId: order.id, kind, date: issuedAt }),
            issueDate: formatJalaliDate(issuedAt),
            issueDateLong: formatJalaliLong(issuedAt),
            dueLabel: kind === "proforma" ? "پرداخت پیش از" : "تاریخ پرداخت",
            dueDate: order.paidAt ? formatJalaliDate(order.paidAt) : undefined,
            sellerName: "مُداشاپ",
            sellerTagline: "فروشگاه مزون و کالای خارجی",
            buyer: {
              name: addressSnapshot.fullName,
              title: addressSnapshot.title,
              province: addressSnapshot.province,
              city: addressSnapshot.city,
              detail: addressSnapshot.detail,
              postalCode: addressSnapshot.postalCode,
              phone: addressSnapshot.phone,
            },
            items: order.items.map((item) => ({
              id: item.id,
              title: item.title,
              quantity: item.quantity,
              price: item.price,
              source: item.source,
              sourceUrl: sourceUrlByItemId.get(item.id) ?? null,
              secondarySourceUrl: item.secondarySourceUrl,
              variantLabel: item.variantLabel,
              purchaseStatus: item.purchaseStatus,
              purchaseNote: item.purchaseNote,
            })),
            isAdmin,
            subtotal: order.subtotal,
            discountTotal: order.discountTotal,
            couponCode: order.couponCode,
            shippingCost: order.shippingCost,
            cargoCost: order.cargoCost,
            walletUsed: order.walletUsed,
            shippingWalletOffset: order.shippingPayment?.walletOffset,
            total: order.total,
            hasExternalItems,
            statusLabel: customerOrderStatusLabel(
              order.status,
              order.paymentStatus,
              STATUS_LABELS[order.status] ?? order.status,
              hasExternalItems
            ),
            paymentStatusLabel: paymentStatusLabel(order.paymentStatus),
            shippingMethod: order.shippingMethod,
            trackingCode: order.trackingCode,
          }}
        />
      </div>
    </div>
  );
}
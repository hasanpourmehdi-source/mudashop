import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CancelOrderButton } from "@/components/CancelOrderButton";
import { OrderTracking } from "@/components/OrderTracking";
import { ReturnRequestSection } from "@/components/ReturnRequestSection";
import { CustomerOrderItemsReview } from "@/components/CustomerOrderItemsReview";
import { OrderMessageThread } from "@/components/OrderMessageThread";
import { OrderPaymentHistory } from "@/components/OrderPaymentHistory";
import { ItemMismatchDecision } from "@/components/ItemMismatchDecision";
import { parseTrackingCodes } from "@/lib/trackingCodes";
import { PURCHASE_OUTCOME_LABELS } from "@/lib/orderPurchaseStatus";

const RETURN_WINDOW_DAYS = 7;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      returnRequest: { include: { items: true } },
      shippingPayment: true,
      paymentEvents: { orderBy: { assignedAt: "asc" } },
    },
  });

  if (!order || (order.userId !== session.user.id && session.user.role !== "ADMIN")) {
    notFound();
  }

  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");

  const withinReturnWindow =
    order.status === "DELIVERED" &&
    !!order.deliveredAt &&
    (Date.now() - order.deliveredAt.getTime()) / (1000 * 60 * 60 * 24) <= RETURN_WINDOW_DAYS;

  const addressSnapshot = JSON.parse(order.addressSnapshot) as {
    title: string;
    fullName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    detail: string;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">سفارش #{order.id.slice(-8)}</h1>
        {order.status !== "CANCELLED" && (
          <CancelOrderButton
            orderId={order.id}
            status={order.status}
            hasExternalItems={hasExternalItems}
            paymentStatus={order.paymentStatus}
          />
        )}
      </div>

      <Suspense fallback={null}>
        <OrderTracking
          initialOrder={{
            id: order.id,
            status: order.status,
            paymentStatus: order.paymentStatus,
            paymentAuthority: order.paymentAuthority,
            itemsNegotiationStatus: order.itemsNegotiationStatus,
            hasExternalItems,
            items: order.items.map((i) => ({
              source: i.source,
              purchaseStatus: i.purchaseStatus,
              quantity: i.quantity,
            })),
            statusHistory: order.statusHistory.map((h) => ({
              id: h.id,
              status: h.status,
              note: h.note,
              createdAt: h.createdAt.toISOString(),
            })),
            shippingPayment: order.shippingPayment ? { status: order.shippingPayment.status } : null,
          }}
        />
      </Suspense>

      {/* آدرس */}
      <section className="mb-8">
        <h2 className="font-bold mb-2 text-sm">آدرس ارسال</h2>
        <p className="text-sm text-[var(--color-muted)]">
          {addressSnapshot.fullName} — {addressSnapshot.province}، {addressSnapshot.city}،{" "}
          {addressSnapshot.detail} — {addressSnapshot.phone}
        </p>
      </section>

      <OrderPaymentHistory
        events={order.paymentEvents.map((ev) => ({
          id: ev.id,
          round: ev.round,
          purpose: ev.purpose,
          amount: ev.amount,
          cardNumber: ev.cardNumber,
          cardHolder: ev.cardHolder,
          shebaNumber: ev.shebaNumber,
          assignedAt: ev.assignedAt.toISOString(),
          paidAt: ev.paidAt ? ev.paidAt.toISOString() : null,
        }))}
      />

      <ReturnRequestSection
        orderId={order.id}
        orderItems={order.items.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          price: item.price,
        }))}
        isDelivered={order.status === "DELIVERED"}
        withinReturnWindow={withinReturnWindow}
        returnWindowDays={RETURN_WINDOW_DAYS}
        existingReturn={
          order.returnRequest
            ? {
                status: order.returnRequest.status,
                refundAmount: order.returnRequest.refundAmount,
                createdAt: order.returnRequest.createdAt.toISOString(),
                items: order.returnRequest.items.map((i) => ({
                  orderItemId: i.orderItemId,
                  reason: i.reason,
                  description: i.description,
                })),
              }
            : null
        }
      />

      <ItemMismatchDecision
        orderId={order.id}
        items={order.items
          .filter((i) => i.purchaseStatus === "AWAITING_CUSTOMER_DECISION" && i.mismatchOutcome)
          .map((i) => ({
            id: i.id,
            title: i.title,
            purchaseNote: i.purchaseNote,
            mismatchLabel: PURCHASE_OUTCOME_LABELS[i.mismatchOutcome!] ?? i.mismatchOutcome!,
          }))}
      />

      <OrderMessageThread orderId={order.id} viewerRole="CUSTOMER" />

      {/* اقلام */}
      {order.itemsNegotiationStatus !== "AGREED" ? (
        <CustomerOrderItemsReview
          orderId={order.id}
          items={order.items.map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            source: item.source,
          }))}
          itemsNegotiationStatus={order.itemsNegotiationStatus}
        />
      ) : (
        <section className="mb-8 space-y-2">
          <h2 className="font-bold mb-2 text-sm">اقلام سفارش</h2>
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between text-sm border cut-line rounded-lg p-3 bg-white"
            >
              <span>
                {item.title} × {item.quantity}
              </span>
              <span className="font-medium">
                {(item.price * item.quantity).toLocaleString("fa-IR")} تومان
              </span>
            </div>
          ))}
        </section>
      )}

      {/* جمع */}
      <section className="border-t cut-line pt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">جمع اقلام</span>
          <span>{order.subtotal.toLocaleString("fa-IR")} تومان</span>
        </div>
        {order.discountTotal > 0 && (
          <div className="flex justify-between text-green-700">
            <span>تخفیف کوپن {order.couponCode && `(${order.couponCode})`}</span>
            <span>−{order.discountTotal.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">هزینه ارسال</span>
          <span>
            {order.shippingCost === null
              ? order.items.some((i) => i.source === "TRENDYOL")
                ? "بعد از خرید و وزن‌کشی مشخص می‌شود"
                : "در انتظار تعیین توسط ادمین"
              : order.shippingCost === 0
              ? "رایگان"
              : `${order.shippingCost.toLocaleString("fa-IR")} تومان`}
          </span>
        </div>
        {order.cargoCost !== null && (
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">هزینه باربری</span>
            <span>{order.cargoCost.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        {order.shippingMethod && (
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">نحوه ارسال</span>
            <span>{order.shippingMethod}</span>
          </div>
        )}
        {parseTrackingCodes(order.trackingCode).length > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">
              {order.shippingMethod === "پیک موتوری" ? "شماره تماس پیک" : "کد رهگیری"}
            </span>
            <span dir="ltr">{parseTrackingCodes(order.trackingCode).join("، ")}</span>
          </div>
        )}
        {order.giftWrap && (
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">بسته‌بندی هدیه</span>
          </div>
        )}
        {order.walletUsed > 0 && (
          <div className="flex justify-between text-green-700">
            <span>پرداخت از کیف پول</span>
            <span>−{order.walletUsed.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-2">
          <span>
            مبلغ نهایی
            {order.shippingCost === null && (
              <span className="block text-[10px] font-normal text-[var(--color-muted)]">
                موقت -- بدون هزینه ارسال
              </span>
            )}
          </span>
          <span className="text-[var(--color-wine)]">
            {order.total.toLocaleString("fa-IR")} تومان
          </span>
        </div>
      </section>
    </div>
  );
}

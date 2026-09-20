import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CancelOrderButton } from "@/components/CancelOrderButton";
import { CancelRequestButton } from "@/components/CancelRequestButton";
import { OrderTracking } from "@/components/OrderTracking";
import { OrderPackages } from "@/components/OrderPackages";
import { ReturnRequestSection } from "@/components/ReturnRequestSection";
import { CustomerOrderItemsReview } from "@/components/CustomerOrderItemsReview";
import { OrderMessageThread } from "@/components/OrderMessageThread";
import { OrderPaymentHistory } from "@/components/OrderPaymentHistory";
import { OrderInvoice } from "@/components/OrderInvoice";
import { ItemMismatchDecision } from "@/components/ItemMismatchDecision";
import { BuyAgainButton } from "@/components/BuyAgainButton";
import { OrderItemReviewButton } from "@/components/OrderItemReviewButton";
import { internalTrendyolProductHref } from "@/lib/trendyolProductLink";
import { parseTrackingCodes } from "@/lib/trackingCodes";
import { TrackingCodeView } from "@/components/TrackingCodeView";
import { PURCHASE_OUTCOME_LABELS } from "@/lib/orderPurchaseStatus";
import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";

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
      items: {
        include: {
          product: { select: { slug: true, isReturnable: true } },
          externalSite: { select: { isReturnable: true } },
        },
      },
      statusHistory: { orderBy: { createdAt: "asc" } },
      returnRequest: { include: { items: true } },
      cancellationRequest: true,
      shippingPayment: true,
      paymentEvents: { orderBy: { assignedAt: "asc" } },
    },
  });

  if (!order || (order.userId !== session.user.id && session.user.role !== "ADMIN")) {
    notFound();
  }

  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");

  // لینک سریع هر قلم به صفحه محصول (شماره ۸ از شکاف‌های مقایسه با سایت‌های مطرح):
  //  - قلم مزون -> لینک داخلی خود سایت (از slug محصول snapshot)
  //  - قلم ترندیول -> لینک داخلیِ خودِ مداشاپ (/products/trendyol/{contentId}...)
  //    تا مشتری از سایت خارج نشه؛ آدرس اصلیِ ترندیول (از کشِ contentId) فقط
  //    برای ساختن اسلاگِ سئوی همین لینک استفاده می‌شه، نه به‌عنوان href
  const spreadUrlByItemId: Record<string, string | null> = {};
  for (const item of order.items) {
    if (item.source === "MAZON") {
      spreadUrlByItemId[item.id] = item.product?.slug ? `/products/mazon/${item.product.slug}` : null;
    } else if (item.source === "TRENDYOL" && item.externalId) {
      const trendyolUrl = await getCachedTrendyolProductUrl(item.externalId);
      spreadUrlByItemId[item.id] = internalTrendyolProductHref(item.externalId, trendyolUrl);
    } else {
      spreadUrlByItemId[item.id] = null;
    }
  }

  const nonReturnableProductsEnabled = await getSiteSettingBool(SITE_SETTING_KEYS.NON_RETURNABLE_PRODUCTS_ENABLED);
  const selfServiceReturnEnabled = await getSiteSettingBool(SITE_SETTING_KEYS.SELF_SERVICE_RETURN_ENABLED);
  // فقط وقتی فلگِ سراسری روشنه معنی داره -- وگرنه (رفتار قبلی) همه‌چیز قابل‌مرجوعه.
  // دو سطحِ جدا: اقلامِ مزون فلگِ خودِ محصول رو چک می‌کنن، اقلامِ ترندیول فلگِ
  // سطحِ سایتِ خارجی‌شون رو (چون یه محصولِ خارجیِ جداگانه توی DB نداریم -- ممکنه
  // ترندیول مرجوعی داشته باشه ولی میلا نداشته باشه، یا برعکس). اگه سایتِ اون
  // قلم نامشخص باشه (مثلاً دموی قدیمی)، محافظه‌کارانه قابل‌مرجوع فرض می‌شه
  const isItemReturnable = (item: (typeof order.items)[number]) => {
    if (!nonReturnableProductsEnabled) return true;
    if (item.source === "MAZON") return item.product?.isReturnable !== false;
    if (item.source === "TRENDYOL") return item.externalSite?.isReturnable !== false;
    return true;
  };

  const withinReturnWindow =
    order.status === "DELIVERED" &&
    !!order.deliveredAt &&
    (Date.now() - order.deliveredAt.getTime()) / (1000 * 60 * 60 * 24) <= RETURN_WINDOW_DAYS;

  // دکمه‌ی «نظر بده» زیر هر قلم فقط وقتی سفارش تحویل داده شده معنی داره -- هر
  // قلمِ سفارش (نه هر محصول) جدا نظرپذیره، چون شاید همین محصول رو قبلاً هم
  // خریده و برای اون خرید نظر داده، ولی این خریدِ جدید هنوز نظر نخورده
  const reviewedOrderItemIds = new Set<string>();
  if (order.status === "DELIVERED") {
    const myReviews = await prisma.review.findMany({
      where: { userId: session.user.id, orderItemId: { not: null } },
      select: { orderItemId: true },
    });
    for (const r of myReviews) {
      if (r.orderItemId) reviewedOrderItemIds.add(r.orderItemId);
    }
  }

  const canReorder = order.items.some(
    (i) => (i.source === "MAZON" && !!i.productId) || (i.source === "TRENDYOL" && !!i.externalId)
  );

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
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">سفارش #{order.id.slice(-8)}</h1>
          {order.paymentMethod === "CASH_ON_DELIVERY" && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              پرداخت در محل
            </span>
          )}
        </div>
        {order.status !== "CANCELLED" && (
          <>
            <CancelOrderButton
              orderId={order.id}
              status={order.status}
              hasExternalItems={hasExternalItems}
              paymentStatus={order.paymentStatus}
              itemPurchaseStatuses={order.items.map((i) => i.purchaseStatus)}
            />
            <CancelRequestButton
              orderId={order.id}
              status={order.status}
              hasExternalItems={hasExternalItems}
              paymentStatus={order.paymentStatus}
              itemPurchaseStatuses={order.items.map((i) => i.purchaseStatus)}
              existingRequest={
                order.cancellationRequest
                  ? {
                      id: order.cancellationRequest.id,
                      status: order.cancellationRequest.status,
                      reason: order.cancellationRequest.reason,
                      adminNote: order.cancellationRequest.adminNote,
                    }
                  : null
              }
            />
          </>
        )}
        {order.status === "CANCELLED" && canReorder && <BuyAgainButton orderId={order.id} />}
      </div>

      <Suspense fallback={null}>
        {hasExternalItems && (
          <OrderPackages
            trackingCode={order.trackingCode}
            packageStatuses={order.packageStatuses}
            items={order.items
              .filter((i) => i.source === "TRENDYOL")
              .map((i) => ({ source: i.source, purchaseStatus: i.purchaseStatus, quantity: i.quantity }))}
          />
        )}
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
            shippingMethod: order.shippingMethod,
            createdAt: order.createdAt.toISOString(),
            packageStatuses: order.packageStatuses,
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
          isReturnable: isItemReturnable(item),
          source: item.source,
        }))}
        isDelivered={order.status === "DELIVERED"}
        withinReturnWindow={withinReturnWindow}
        returnWindowDays={RETURN_WINDOW_DAYS}
        selfServiceEnabled={selfServiceReturnEnabled}
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
            url: spreadUrlByItemId[item.id] ?? undefined,
            variantLabel: item.variantLabel ?? undefined,
          }))}
          itemsNegotiationStatus={order.itemsNegotiationStatus}
        />
      ) : (
        <section className="mb-8 space-y-2">
          <h2 className="font-bold mb-2 text-sm">اقلام سفارش</h2>
          {order.items.map((item) => {
            const itemUrl = spreadUrlByItemId[item.id];
            const isExternal = itemUrl?.startsWith("http");
            return (
              <div
                key={item.id}
                className="border cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span>
                    {itemUrl ? (
                      <a
                        href={itemUrl}
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                        className="text-[var(--color-wine)] hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                    {item.variantLabel && (
                      <span className="text-xs text-[var(--color-muted)]"> ({item.variantLabel})</span>
                    )}
                    {" × "}
                    {item.quantity}
                  </span>
                  <span className="font-medium">
                    {(item.price * item.quantity).toLocaleString("fa-IR")} تومان
                  </span>
                </div>
                <OrderMessageThread orderId={order.id} viewerRole="CUSTOMER" itemId={item.id} title="توضیحات این کالا" compact />
                {order.status === "DELIVERED" && (item.productId || item.externalId) && (
                  <OrderItemReviewButton
                    productId={item.productId ?? undefined}
                    externalId={item.externalId ?? undefined}
                    orderItemId={item.id}
                    title={item.title}
                    variantLabel={item.variantLabel}
                    image={item.image}
                    alreadyReviewed={reviewedOrderItemIds.has(item.id)}
                  />
                )}
              </div>
            );
          })}
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
        {order.shippingPayment && order.shippingPayment.walletOffset > 0 && (
          <div className="flex justify-between text-green-700">
            <span>کسر از کیف پول (بابت ارسال/باربری)</span>
            <span>−{order.shippingPayment.walletOffset.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        {order.shippingPayment && order.shippingPayment.walletOffset > 0 && order.shippingPayment.amount > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">باقی‌مانده‌ی ارسال/باربری (پرداخت با کارت)</span>
            <span>{order.shippingPayment.amount.toLocaleString("fa-IR")} تومان</span>
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
            <span className="flex flex-wrap justify-end gap-2">
              {parseTrackingCodes(order.trackingCode).map((code) => (
                <TrackingCodeView key={code} code={code} shippingMethod={order.shippingMethod} />
              ))}
            </span>
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

      <div className="mt-4 flex items-center gap-4">
        <OrderInvoice orderId={order.id} />
      </div>
    </div>
  );
}

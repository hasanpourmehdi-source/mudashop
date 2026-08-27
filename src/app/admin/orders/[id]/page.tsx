import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_NOTIFICATION_MESSAGES } from "@/lib/orderStatusMessages";
import { AdminOrderActions } from "@/components/AdminOrderActions";
import { AdminOrderItemsEditor } from "@/components/AdminOrderItemsEditor";
import { OrderMessageThread } from "@/components/OrderMessageThread";
import { AdminReturnRequestPanel } from "@/components/AdminReturnRequestPanel";
import { AdminCancellationRequestPanel } from "@/components/AdminCancellationRequestPanel";
import { OrderPaymentHistory } from "@/components/OrderPaymentHistory";
import { parseTrackingCodes } from "@/lib/trackingCodes";
import { checkTrendyolItemsStock } from "@/lib/orderStockCheck";
import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { internalTrendyolProductHref } from "@/lib/trendyolProductLink";
import { AdminItemPurchasePanel } from "@/components/AdminItemPurchasePanel";
import { AdminChangeAddressPanel } from "@/components/AdminChangeAddressPanel";
import { OrderInvoice } from "@/components/OrderInvoice";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پردازش",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "نیاز به تعیین هزینه ارسال",
  AWAITING_PAYMENT: "منتظر پرداخت مشتری",
  AWAITING_VERIFICATION: "در انتظار تأیید فیش",
  PAID: "پرداخت‌شده",
  FAILED: "پرداخت ناموفق",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (session.user.role !== "ADMIN") notFound();

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { slug: true } } } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      user: { select: { name: true, email: true } },
      shippingPayment: true,
      returnRequest: { include: { items: true } },
      cancellationRequest: true,
      paymentEvents: { orderBy: { assignedAt: "asc" } },
    },
  });
  if (!order) notFound();

  // اولین باری که ادمین یه سفارش «در انتظار پردازش» رو باز می‌کنه، یعنی عملاً
  // شروع به بررسیش کرده -- پس خودکار به «در حال پردازش» می‌ره، بدون نیاز به
  // اینکه دستی از دراپ‌داون وضعیت انتخاب کنه. بعد از این‌جا status دیگه PENDING
  // نیست، پس بازدیدهای بعدی این شرط دوباره اجرا نمی‌شن (نه تاریخچه‌ی تکراری، نه
  // نوتیفیکیشن تکراری برای مشتری)
  if (order.status === "PENDING") {
    await prisma.order.update({ where: { id: order.id }, data: { status: "PROCESSING" } });
    const historyEntry = await prisma.orderStatusHistory.create({
      data: { orderId: order.id, status: "PROCESSING", note: "ادمین سفارش را بررسی و پردازش آن را شروع کرد" },
    });
    await prisma.notification.create({
      data: {
        userId: order.userId,
        message: ORDER_STATUS_NOTIFICATION_MESSAGES.PROCESSING!,
        link: `/orders/${order.id}`,
      },
    });
    order.status = "PROCESSING";
    order.statusHistory.push(historyEntry);
  }

  const bankCards = await prisma.bankCard.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");
  const cargoRatePerKgDefault = await getSiteSetting(SITE_SETTING_KEYS.CARGO_RATE_PER_KG);

  // این لحظه (ادمین در حال تصمیم‌گیری برای تأیید/رد فیش پرداخت اقلامه) دقیقاً
  // همون لحظه‌ای‌ه که خرید واقعی از ترندیول قراره انجام بشه -- پس همین‌جا
  // موجودی لحظه‌ای رو چک می‌کنیم تا اگه کالا دیگه موجود نیست، ادمین به‌جای
  // تأیید، فیش رو رد کنه (با دلیل «ناموجود»، از همون فرم رد پرداخت موجود)
  const stockStatusByItemId = new Map<string, boolean | null>();
  if (order.paymentStatus === "AWAITING_VERIFICATION" && hasExternalItems) {
    const results = await checkTrendyolItemsStock(
      order.items.filter((i) => i.source === "TRENDYOL").map((i) => ({ id: i.id, externalId: i.externalId }))
    );
    for (const r of results) stockStatusByItemId.set(r.orderItemId, r.inStock);
  }
  const outOfStockItems = order.items.filter((i) => stockStatusByItemId.get(i.id) === false);

  // ادمین باید در هر مرحله‌ای از سفارش (نه فقط بعد از پرداخت) بتونه مستقیم به
  // صفحه‌ی محصول اصلی روی ترندیول بره -- لینک از همون کشِ آدرسِ محصول (که با
  // هر بازدید از صفحه‌ی محصول/نگاه‌سریع پر می‌شه) بر اساس externalId درمیاد
  const productUrlByItemId = new Map<string, string | null>();
  const externalItemsForUrl = order.items.filter((i) => i.source === "TRENDYOL" && i.externalId);
  await Promise.all(
    externalItemsForUrl.map(async (i) => {
      productUrlByItemId.set(i.id, await getCachedTrendyolProductUrl(i.externalId!));
    })
  );

  // لینک داخلی صفحه‌ی محصول (خودِ مداشاپ) برای هر قلم -- برای کلیک روی عنوان
  // که ادمین رو وارد صفحه‌ی محصول کنه، جدا از لینک اصلی/خارجی ترندیول
  const productHrefByItemId = new Map<string, string | null>();
  for (const item of order.items) {
    if (item.source === "MAZON") {
      productHrefByItemId.set(item.id, item.product?.slug ? `/products/mazon/${item.product.slug}` : null);
    } else if (item.source === "TRENDYOL" && item.externalId) {
      productHrefByItemId.set(
        item.id,
        internalTrendyolProductHref(item.externalId, productUrlByItemId.get(item.id) ?? null)
      );
    } else {
      productHrefByItemId.set(item.id, null);
    }
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

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">سفارش #{order.id.slice(-8)}</h1>
        <div className="flex items-center gap-2">
          {order.paymentMethod === "CASH_ON_DELIVERY" && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              پرداخت در محل
            </span>
          )}
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--color-linen-dim)]">
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </span>
        </div>
      </div>

      <p className="text-sm text-[var(--color-muted)] mb-6">
        {order.user.name ?? order.user.email} · {order.user.email} ·{" "}
        {new Date(order.createdAt).toLocaleString("fa-IR")}
      </p>

      <AdminOrderActions
        orderId={order.id}
        status={order.status}
        paymentStatus={order.paymentStatus}
        paymentMethod={order.paymentMethod}
        freeShippingApplied={order.freeShippingApplied}
        receiptImage={order.receiptImage}
        bankCards={bankCards}
        hasExternalItems={hasExternalItems}
        shippingMethod={order.shippingMethod}
        trackingCode={order.trackingCode}
        itemsNegotiationStatus={order.itemsNegotiationStatus}
        shippingPayment={
          order.shippingPayment
            ? {
                status: order.shippingPayment.status,
                amount: order.shippingPayment.amount,
                receiptImage: order.shippingPayment.receiptImage,
              }
            : null
        }
        externalItems={order.items
          .filter((i) => i.source === "TRENDYOL")
          .map((i) => ({
            id: i.id,
            title: i.title,
            quantity: i.quantity,
            price: i.price,
            purchaseStatus: i.purchaseStatus,
            purchasePriceActual: i.purchasePriceActual,
            itemWeightGrams: i.itemWeightGrams,
            itemCargoCost: i.itemCargoCost,
          }))}
        cargoRatePerKgDefault={cargoRatePerKgDefault}
      />

      {order.paymentStatus === "PAID" && (
        <AdminItemPurchasePanel
          orderId={order.id}
          hasPendingCancellationRequest={order.cancellationRequest?.status === "PENDING"}
          items={order.items
            .filter((i) => i.source === "TRENDYOL")
            .map((i) => ({
              id: i.id,
              title: i.title,
              quantity: i.quantity,
              price: i.price,
              purchaseStatus: i.purchaseStatus,
              purchaseTag: i.purchaseTag,
              purchaseNote: i.purchaseNote,
              purchasePriceActual: i.purchasePriceActual,
              purchaseUrl: i.purchaseUrl,
              url: productUrlByItemId.get(i.id) ?? null,
              productHref: productHrefByItemId.get(i.id) ?? null,
              itemWeightGrams: i.itemWeightGrams,
              itemCargoCost: i.itemCargoCost,
              variantLabel: i.variantLabel,
              secondarySourceUrl: i.secondarySourceUrl,
            }))}
        />
      )}

      {order.statusHistory.length > 0 && (
        <section className="mb-8 border cut-line rounded-lg p-4 bg-white text-sm space-y-1">
          <h2 className="font-bold mb-2">تاریخچه وضعیت</h2>
          {order.statusHistory.map((h) => (
            <p key={h.id} className="text-xs text-[var(--color-muted)]">
              {h.note || STATUS_LABELS[h.status] || h.status} — {new Date(h.createdAt).toLocaleString("fa-IR")}
            </p>
          ))}
        </section>
      )}

      {order.cancellationRequest && (
        <AdminCancellationRequestPanel
          orderId={order.id}
          orderStatus={order.status}
          cancellationRequest={{
            id: order.cancellationRequest.id,
            status: order.cancellationRequest.status,
            reason: order.cancellationRequest.reason,
            adminNote: order.cancellationRequest.adminNote,
            createdAt: order.cancellationRequest.createdAt.toISOString(),
          }}
        />
      )}

      {order.returnRequest && (
        <AdminReturnRequestPanel
          returnRequest={{
            id: order.returnRequest.id,
            status: order.returnRequest.status,
            refundAmount: order.returnRequest.refundAmount,
            createdAt: order.returnRequest.createdAt.toISOString(),
            items: order.returnRequest.items.map((i) => ({
              orderItemId: i.orderItemId,
              reason: i.reason,
              description: i.description,
            })),
          }}
          orderItemTitles={Object.fromEntries(order.items.map((i) => [i.id, i.title]))}
        />
      )}

      <OrderMessageThread orderId={order.id} viewerRole="ADMIN" />

      {order.paymentEvents.length > 0 ? (
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
      ) : (
        order.assignedCardNumber && (
          <section className="mb-8 text-sm">
            <h2 className="font-bold mb-2">کارت تخصیص‌داده‌شده</h2>
            <p className="text-[var(--color-muted)]" dir="ltr">
              {order.assignedCardNumber} — {order.assignedCardHolder}
            </p>
            {order.assignedShebaNumber && (
              <p className="text-[var(--color-muted)] text-xs mt-1" dir="ltr">
                شبا: {order.assignedShebaNumber}
              </p>
            )}
          </section>
        )
      )}

      <section className="mb-8">
        <h2 className="font-bold mb-2 text-sm">آدرس ارسال</h2>
        <p className="text-sm text-[var(--color-muted)]">
          {addressSnapshot.fullName} — {addressSnapshot.province}، {addressSnapshot.city}،{" "}
          {addressSnapshot.detail} — {addressSnapshot.phone}
        </p>
      </section>

      <AdminChangeAddressPanel
        orderId={order.id}
        status={order.status}
        currentAddress={addressSnapshot}
        hasExternalItems={hasExternalItems}
        currentShippingMethod={order.shippingMethod}
        currentShippingCost={order.shippingCost}
        bankCards={bankCards}
      />

      {order.paymentStatus === "PENDING" ? (
        <AdminOrderItemsEditor
          orderId={order.id}
          items={order.items.map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            source: item.source,
            url: productHrefByItemId.get(item.id) ?? null,
            originalUrl: item.source === "TRENDYOL" ? productUrlByItemId.get(item.id) ?? null : null,
            variantLabel: item.variantLabel,
            secondarySourceUrl: item.secondarySourceUrl,
          }))}
          itemsNegotiationStatus={order.itemsNegotiationStatus}
        />
      ) : (
        <section className="mb-8 space-y-2">
          <h2 className="font-bold mb-2 text-sm">اقلام سفارش</h2>

          {outOfStockItems.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-xs text-red-700 mb-2">
              ⚠️ {outOfStockItems.length.toLocaleString("fa-IR")} کالا از این سفارش دیگر روی ترندیول موجود
              نیست. قبل از تأیید فیش پرداخت، بهتره فیش رو رد کنی (با دلیل «ناموجود شدن کالا»).
            </div>
          )}

          {order.items.map((item) => {
            const stock = stockStatusByItemId.get(item.id);
            const itemHref = productHrefByItemId.get(item.id);
            const originalUrl = item.source === "TRENDYOL" ? productUrlByItemId.get(item.id) : null;
            return (
              <div
                key={item.id}
                className="border cut-line rounded-lg p-3 bg-white space-y-2"
              >
              <div className="flex justify-between text-sm">
                <span>
                  {itemHref ? (
                    <a href={itemHref} className="text-[var(--color-wine)] hover:underline">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                  {item.variantLabel && (
                    <span className="text-xs text-[var(--color-muted)]"> ({item.variantLabel})</span>
                  )}
                  {originalUrl && (
                    <a
                      href={originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[10px] text-[var(--color-wine)] hover:underline"
                    >
                      🔗 لینک اصلی
                    </a>
                  )}
                  {item.secondarySourceUrl && (
                    <a
                      href={item.secondarySourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[10px] text-[var(--color-ochre)] hover:underline"
                    >
                      🔗 لینک اصلی ۲ (فقط ادمین)
                    </a>
                  )}
                  {" × "}
                  {item.quantity}
                  {stock === false && (
                    <span className="mr-2 ml-2 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      دیگر موجود نیست
                    </span>
                  )}
                  {stock === true && (
                    <span className="mr-2 ml-2 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      موجود است
                    </span>
                  )}
                  {stock === null && (
                    <span
                      className="mr-2 ml-2 text-xs font-bold text-[var(--color-muted)] bg-[var(--color-linen-dim)] px-2 py-0.5 rounded-full"
                      title="لینک محصول کش نشده یا بررسی زنده با خطا مواجه شد -- موجودی این کالا معلوم نیست"
                    >
                      بررسی موجودی ممکن نشد
                    </span>
                  )}
                </span>
                <span className="font-medium">
                  {(item.price * item.quantity).toLocaleString("fa-IR")} تومان
                </span>
              </div>
              <OrderMessageThread orderId={order.id} viewerRole="ADMIN" itemId={item.id} title="توضیحات این کالا" compact />
              </div>
            );
          })}
        </section>
      )}

      <section className="border-t cut-line pt-4 space-y-1 text-sm mb-8">
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
              ? hasExternalItems
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
            <span dir="ltr">{parseTrackingCodes(order.trackingCode).join("، ")}</span>
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

      <div className="mt-4">
        <OrderInvoice orderId={order.id} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { customerOrderStatusLabel, shippingPaymentStatusLabel } from "@/lib/orderStatusMessages";
import { computePurchaseSummary } from "@/lib/orderPurchaseStatus";
import { estimateDeliveryWindow, formatEta } from "@/lib/orderEta";
import { computeDelayInfo } from "@/lib/orderDelay";
import { buildTrackingTimeline } from "@/lib/trackingTimeline";
import { TrackingTimeline } from "@/components/TrackingTimeline";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { usePollIntervalMs } from "@/components/ClientPollingProvider";

type StatusHistoryEntry = {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
};

export type OrderTrackingData = {
  id: string;
  status: string;
  paymentStatus: "PENDING" | "AWAITING_PAYMENT" | "AWAITING_VERIFICATION" | "PAID" | "FAILED";
  paymentAuthority: string | null;
  itemsNegotiationStatus: string;
  statusHistory: StatusHistoryEntry[];
  hasExternalItems: boolean;
  shippingPayment?: { status: string } | null;
  items?: { source: string; purchaseStatus: string; quantity: number }[];
  shippingMethod?: string | null;
  createdAt?: string;
  packageStatuses?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پردازش",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

// نوار وضعیت قبلاً فقط ۳ نقطه داشت (پردازش/ارسال/تحویل) و همه‌ی زیرمرحله‌ها
// (منتظر پرداخت، در صف خرید، پرداخت باربری، ...) فقط توی برچسبِ متنیِ همون
// یه نقطه‌ی «پردازش» جمع می‌شدن -- مشتری نمی‌فهمید چندتا مرحله‌ی واقعی جلوشه.
// الان هر مرحله‌ی واقعی یه نقطه‌ی جداست؛ چون سفارش‌های حاوی کالای خارجی یه دور
// پرداخت اضافه (هزینه ارسال/باربری، بعد از خریدِ واقعی از ترندیول) دارن که
// سفارش‌های خالص مزون ندارن، تعداد نقطه‌ها بین این دو نوع سفارش فرق می‌کنه:
// مزون ۵ نقطه، خارجی ۶ نقطه
const STEPS_MAZON = ["ثبت سفارش", "پرداخت", "آماده‌سازی", "ارسال", "تحویل"];
const STEPS_EXTERNAL = ["ثبت سفارش", "پرداخت اقلام", "در صف خرید", "پرداخت ارسال", "ارسال", "تحویل"];

type Stage = { stepIndex: number; sublabel: string };

// برای سفارش‌های PROCESSING، ایندکسِ نقطه‌ی «پرداخت اقلام» همیشه ۱ (بعد از
// «ثبت سفارش») است -- هم توی نوار ۵تایی هم ۶تایی
const PAYMENT_STEP_INDEX = 1;

// وقتی ShippingPayment به وضعیت FAILED می‌رسه، دو دلیل کاملاً متفاوت ممکنه
// پشتش باشه: فیش پرداخت هزینه ارسال توسط ادمین رد شده (verify-shipping-payment)،
// یا بسته توسط پست/پیک برگشت خورده (mark-returned-to-sender) -- این دو باید
// کپشن متفاوت داشته باشن، نه یه برچسبِ عمومیِ یکسان «رد شده». هر دو مسیر یه
// note مشخص و قابل‌تشخیص توی OrderStatusHistory ثبت می‌کنن؛ آخرین موردِ
// مرتبط رو پیدا می‌کنیم تا حتی اگه چندبار این چرخه تکرار شده باشه، درست باشه
function shippingFailureSublabel(order: OrderTrackingData): string {
  const relevant = [...order.statusHistory]
    .reverse()
    .find((h) => h.note?.includes("برگشت خورد") || h.note?.includes("فیش هزینه ارسال/باربری رد شد"));
  if (relevant?.note?.includes("برگشت خورد")) {
    return "بسته توسط پست/پیک برگشت خورد -- منتظر تعیین هزینه‌ی ارسال مجدد توسط ادمین";
  }
  return shippingPaymentStatusLabel("FAILED");
}

function computeStage(order: OrderTrackingData, hasExternalItems: boolean): Stage {
  if (order.status === "PENDING") {
    return { stepIndex: PAYMENT_STEP_INDEX, sublabel: STATUS_LABELS.PENDING };
  }
  if (order.status === "SHIPPED") {
    return { stepIndex: hasExternalItems ? 4 : 3, sublabel: "" };
  }
  if (order.status === "DELIVERED") {
    return { stepIndex: hasExternalItems ? 5 : 4, sublabel: "" };
  }

  // از این‌جا به بعد order.status === "PROCESSING"ه (CANCELLED/RETURNED جدا
  // و بدون نوار نمایش داده می‌شن، پایین‌تر)

  // ویرایش اقلام سفارش توسط ادمین فقط قبل از تعیین هزینه ارسال (پرداخت PENDING)
  // اتفاق می‌افته -- تا مشتری/ادمین به توافق نرسن، سفارش عملاً همون‌جا (مرحله‌ی
  // «پرداخت») گیر مونده
  if (order.itemsNegotiationStatus === "AWAITING_CUSTOMER_REVIEW") {
    // اگه ادمین موقع ویرایش یه دلیل مشخص نوشته باشه (مثلاً «ناموجود شد، این
    // مورد مشابه رو پیشنهاد می‌کنیم»)، همون دلیل واقعی نشون داده می‌شه -- نه
    // یه پیام عمومی همیشه‌یکسان
    const latestNote = order.statusHistory[order.statusHistory.length - 1]?.note;
    return {
      stepIndex: PAYMENT_STEP_INDEX,
      sublabel: latestNote || "منتظر تأیید شما روی تغییرات اقلام سفارش",
    };
  }
  if (order.itemsNegotiationStatus === "AWAITING_ADMIN_REVIEW") {
    return { stepIndex: PAYMENT_STEP_INDEX, sublabel: "پاسخ شما ثبت شد -- منتظر بررسی ادمین" };
  }

  if (order.paymentStatus !== "PAID") {
    return {
      stepIndex: PAYMENT_STEP_INDEX,
      sublabel: customerOrderStatusLabel("PROCESSING", order.paymentStatus, "", hasExternalItems),
    };
  }

  // دور دوم (ShippingPayment) با شکست مواجه شده -- چه به‌خاطر رد فیش چه
  // برگشت‌خوردن بسته -- برای هر دو نوع سفارش (مزون و خارجی) صدق می‌کنه؛ برای
  // مزون چون نقطه‌ی جدا برای این دور نداریم (۵ نقطه)، همچنان روی «آماده‌سازی»
  // می‌مونیم ولی زیرنویس باید واقعیت رو نشون بده، نه برچسب عمومیِ «آماده‌سازی»
  if (order.shippingPayment?.status === "FAILED") {
    return { stepIndex: hasExternalItems ? 3 : 2, sublabel: shippingFailureSublabel(order) };
  }

  // پرداخت اقلام تسویه شده -- برای مزون این یعنی مستقیم آماده‌سازی؛ برای
  // خارجی یعنی وارد «صف خرید» شده (هنوز دور دوم/پرداخت ارسال شروع نشده). توی
  // همین بازه، اگه بعضی از اقلام خارجی تک‌به‌تک خریداری/کنسل شده باشن، به‌جای
  // برچسب عمومیِ «در صف خرید»، پیشرفت واقعی (مثلاً «۲ از ۳ خریداری شد») نشون
  // داده می‌شه -- بدون نیاز به نقطه‌ی جدید توی نوار
  if (!hasExternalItems || !order.shippingPayment) {
    if (hasExternalItems && order.items) {
      const summary = computePurchaseSummary(order.items);
      if (summary.total > 0 && summary.purchased + summary.cancelled > 0) {
        const sublabel = summary.allArrived
          ? summary.allCancelled
            ? "هیچ‌کدوم از اقلام قابل خریداری‌شدن نبودن"
            : "همه‌ی اقلام سفارش به انبار رسید -- در حال آماده‌سازی هزینه‌ی ارسال"
          : summary.allResolved
            ? `${summary.purchased} از ${summary.total} کالا خریداری شد -- منتظر رسیدن به انبار`
            : `${summary.purchased} از ${summary.total} کالا خریداری شد -- در حال پیگیری بقیه`;
        return { stepIndex: 2, sublabel };
      }
    }
    return {
      stepIndex: 2,
      sublabel: customerOrderStatusLabel("PROCESSING", order.paymentStatus, "", hasExternalItems),
    };
  }

  // دور دوم (هزینه ارسال/باربری سفارش خارجی) شروع شده
  return { stepIndex: 3, sublabel: shippingPaymentStatusLabel(order.shippingPayment.status) };
}

export function OrderTracking({
  initialOrder,
  disablePolling = false,
}: {
  initialOrder: OrderTrackingData;
  // برای صفحه‌ی پیگیریِ سفارشِ مهمان (بدون لاگین) -- /api/orders/[id] فقط برای
  // صاحبِ سفارشِ لاگین‌کرده پاسخ می‌ده، پس pollِ خودکار روی آن صفحه فقط ۴۰۱
  // مکرر می‌سازه؛ مهمان به‌جاش خودش دوباره فرمِ پیگیری رو می‌فرسته
  disablePolling?: boolean;
}) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState(initialOrder);
  const paymentBanner = searchParams.get("payment"); // 'paid' | 'failed' از ریدایرکت درگاه
  const intervalMs = usePollIntervalMs();

  // فقط وقتی سفارش هنوز در جریانه (نه لغوشده/تحویل‌شده) لازم به poll کردنه؛
  // بازه از تنظیماتِ ادمین، و وقتی تب پنهانه متوقف
  const finished = order.status === "CANCELLED" || order.status === "DELIVERED" || order.status === "RETURNED";
  useVisiblePolling(
    async () => {
      const res = await fetch(`/api/orders/${order.id}`);
      if (res.ok) setOrder(await res.json());
    },
    intervalMs,
    { enabled: !disablePolling && !finished, runImmediately: false },
  );

  const steps = order.hasExternalItems ? STEPS_EXTERNAL : STEPS_MAZON;
  const { stepIndex: currentStepIndex, sublabel: currentSublabel } = computeStage(order, order.hasExternalItems);

  // تخمین زمان تحویل (ETA) -- فقط وقتی نمایش داده می‌شه که سفارش هنوز بازه و
  // تحویل نشده (سفارش بسته/لغو/مرجوع ETA نداره)
  const eta =
    !["CANCELLED", "RETURNED"].includes(order.status) && order.createdAt
      ? estimateDeliveryWindow(
          {
            status: order.status,
            shippingMethod: order.shippingMethod ?? null,
            hasExternalItems: order.hasExternalItems,
            createdAt: new Date(order.createdAt),
            statusHistory: order.statusHistory.map((h) => ({ status: h.status, createdAt: new Date(h.createdAt) })),
          },
          new Date()
        )
      : null;

  // تأخیر + علت دقیق + ETA جدید (شماره ۷) -- اگه سفارش دیر شده، بنر تأخیر با
  // علت و تخمین جدید نمایش داده می‌شه (به‌جای ETA عادی)
  const delayInfo =
    !["CANCELLED", "RETURNED"].includes(order.status) && order.createdAt
      ? computeDelayInfo(
          {
            status: order.status,
            paymentStatus: order.paymentStatus,
            hasExternalItems: order.hasExternalItems,
            itemsNegotiationStatus: order.itemsNegotiationStatus,
            shippingMethod: order.shippingMethod ?? null,
            createdAt: new Date(order.createdAt),
            statusHistory: order.statusHistory.map((h) => ({
              status: h.status,
              createdAt: new Date(h.createdAt),
              note: h.note,
            })),
            shippingPayment: order.shippingPayment ? { status: order.shippingPayment.status } : null,
          },
          new Date()
        )
      : null;

  // سفارش‌های لغو/مرجوع نباید بنر پرداخت یا دکمه‌ی «ادامه پرداخت» نشون بدن
  const isClosed = order.status === "CANCELLED" || order.status === "RETURNED";

  // تایملاین رهگیری مرحله‌به‌مرحله -- ترکیب تاریخچه‌ی وضعیت + تحویلِ تکی
  // بسته‌ها (ETA در هدر نمایش داده می‌شه و این‌جا تکرار نمی‌شه)
  const timelineEntries = buildTrackingTimeline({
    status: order.status,
    statusHistory: order.statusHistory,
    packageStatuses: order.packageStatuses,
  });

  return (
    <div>
      {paymentBanner === "paid" && (
        <div className="mb-6 bg-green-100 text-green-800 text-sm font-medium rounded-lg p-3 text-center">
          پرداخت با موفقیت انجام شد ✓
        </div>
      )}
      {paymentBanner === "failed" && (
        <div className="mb-6 bg-red-100 text-red-700 text-sm font-medium rounded-lg p-3 text-center">
          پرداخت ناموفق بود و سفارش لغو شد.
        </div>
      )}

      {!isClosed && order.paymentStatus === "PENDING" && (
        <div className="mb-6 bg-[var(--color-ochre)]/10 border border-[var(--color-ochre)] rounded-lg p-4 text-center">
          <span className="text-sm font-medium">
            سفارش شما ثبت شده و در انتظار بررسی ادمین است.
          </span>
        </div>
      )}

      {!isClosed && order.paymentStatus === "AWAITING_PAYMENT" && order.paymentAuthority && (
        <div className="mb-6 bg-[var(--color-ochre)]/10 border border-[var(--color-ochre)] rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-medium">شماره کارت برای پرداخت آماده است.</span>
          <Link
            href={`/payment/bank-transfer/${order.paymentAuthority}`}
            className="bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full text-sm font-medium"
          >
            ادامه پرداخت
          </Link>
        </div>
      )}

      {!isClosed && order.paymentStatus === "AWAITING_VERIFICATION" && (
        <div className="mb-6 bg-[var(--color-ochre)]/10 border border-[var(--color-ochre)] rounded-lg p-4 text-center">
          <span className="text-sm font-medium">
            فیش پرداخت شما ارسال شده و در انتظار تأیید است.
          </span>
        </div>
      )}

      {!isClosed && order.shippingPayment?.status === "AWAITING_PAYMENT" && (
        <div className="mb-6 bg-[var(--color-ochre)]/10 border border-[var(--color-ochre)] rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-medium">
            {shippingPaymentStatusLabel(order.shippingPayment.status)}
            <span className="block text-[10px] font-normal text-[var(--color-muted)]">
              هزینه ارسال این سفارش مشخص شده -- لطفاً واریز کنید و فیش را ثبت نمایید
            </span>
          </span>
          <Link
            href={`/orders/${order.id}/shipping-payment`}
            className="bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full text-sm font-medium"
          >
            پرداخت هزینه ارسال
          </Link>
        </div>
      )}

      {!isClosed && order.shippingPayment?.status === "AWAITING_VERIFICATION" && (
        <div className="mb-6 bg-[var(--color-ochre)]/10 border border-[var(--color-ochre)] rounded-lg p-4 text-center">
          <span className="text-sm font-medium">
            {shippingPaymentStatusLabel(order.shippingPayment.status)}
            <span className="block text-[10px] font-normal text-[var(--color-muted)]">
              فیش هزینه ارسال شما ارسال شده -- کالای شما در حال وزن‌کشی و آماده‌سازی برای ارسال است.
            </span>
          </span>
        </div>
      )}

      {!isClosed && order.shippingPayment?.status === "PAID" &&
        order.status !== "SHIPPED" &&
        order.status !== "DELIVERED" && (
          <div className="mb-6 bg-green-50 border border-green-300 rounded-lg p-4 text-center">
            <span className="text-sm font-medium text-green-800">
              {shippingPaymentStatusLabel(order.shippingPayment.status)}
              <span className="block text-[10px] font-normal text-green-700">
                هزینه ارسال شما تأیید شد -- سفارش برای ارسال آماده‌سازی می‌شود.
              </span>
            </span>
          </div>
        )}

      {order.status === "CANCELLED" ? (
        <div className="mb-6">
          <p className="text-red-600 font-medium">این سفارش لغو شده است.</p>
          {(() => {
            const cancelNote = [...order.statusHistory].reverse().find((h) => h.status === "CANCELLED")?.note;
            return cancelNote ? <p className="text-xs text-[var(--color-muted)] mt-1">{cancelNote}</p> : null;
          })()}
        </div>
      ) : order.status === "RETURNED" ? (
        <p className="mb-6 text-[var(--color-ochre)] font-medium">
          این سفارش مرجوع شده و وجهش به کیف پول بازگشت داده شده است.
        </p>
      ) : (
        <div className="mb-6">
          <div className="flex items-center">
            {steps.map((title, idx) => {
              // پله‌ی آخر («تحویل») وقتی مرحله‌ی فعلیه، یعنی سفارش واقعاً
              // تحویل داده شده -- یه مرحله‌ی «در جریان» نیست، تکمیل‌شده‌ست؛
              // پس باید تیک بخوره، نه فقط شماره‌اش نشون داده بشه
              const isDone = idx < currentStepIndex || (idx === currentStepIndex && idx === steps.length - 1);
              return (
              <div key={title} className="flex-1 flex items-center">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isDone
                        ? "bg-[var(--color-wine)] text-white"
                        : idx === currentStepIndex
                          ? "bg-[var(--color-wine)] text-white ring-4 ring-[var(--color-wine)]/20"
                          : "bg-[var(--color-linen-dim)] text-[var(--color-muted)]"
                    }`}
                  >
                    {isDone ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] text-center ${
                      idx === currentStepIndex
                        ? "text-[var(--color-wine)] font-bold"
                        : idx < currentStepIndex
                          ? "text-[var(--color-muted)]"
                          : "text-[var(--color-muted)]/60"
                    }`}
                  >
                    {title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 -mt-4 transition-colors ${
                      idx < currentStepIndex ? "bg-[var(--color-wine)]" : "bg-[var(--color-line)]"
                    }`}
                  />
                )}
              </div>
              );
            })}
          </div>
          {currentSublabel && (
            <p className="text-xs text-center text-[var(--color-muted)] mt-2">{currentSublabel}</p>
          )}
          {delayInfo?.delayed && delayInfo.reason ? (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
              <p className="text-red-700 font-medium">⚠️ تأخیر در سفارش: {delayInfo.reason}</p>
              {delayInfo.newEta && (
                <p className="text-red-600 mt-1">
                  تحویل تخمینی جدید: <span className="font-bold">{formatEta(delayInfo.newEta)}</span>
                </p>
              )}
            </div>
          ) : eta ? (
            <p className="text-xs text-center text-[var(--color-wine)] font-medium mt-1.5">
              تحویل تخمینی: {formatEta(eta)}
            </p>
          ) : null}
        </div>
      )}

      <TrackingTimeline entries={timelineEntries} />

      {!disablePolling && order.status !== "CANCELLED" && order.status !== "DELIVERED" && order.status !== "RETURNED" && (
        <p className="text-[10px] text-[var(--color-muted)] mb-8">
          وضعیت هر ۸ ثانیه به‌صورت خودکار بروزرسانی می‌شود.
        </p>
      )}
    </div>
  );
}

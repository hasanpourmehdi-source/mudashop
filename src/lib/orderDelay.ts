import { carrierTransitDays, addDays, type EtaWindow } from "@/lib/orderEta";

// تشخیص «تأخیر» و «علت دقیق» + تخمین تحویل جدید. سه سناریوی رایجِ تأخیر:
//  ۱) بسته توسط پست/پیک برگشت خورده (note مخصوص توی تاریخچه ثبت شده)
//  ۲) سفارش ارسال شده ولی از پنجره‌ی ترانزیت شرکت باربری گذشته (هنوز تحویل نشده)
//  ۳) سفارش مدت‌هاست در یه مرحله گیر کرده (در صف خرید / منتظر فیش / ...)
export type DelayOrderInput = {
  status: string;
  paymentStatus: string;
  hasExternalItems: boolean;
  itemsNegotiationStatus: string;
  shippingMethod: string | null;
  createdAt: Date;
  statusHistory: { status: string; createdAt: Date; note: string | null }[];
  shippingPayment: { status: string } | null;
};

export type DelayInfo = {
  delayed: boolean;
  reason: string | null;
  newEta: EtaWindow | null;
};

// اگر سفارشی این‌قدر روز توی یه مرحله گیر کرده باشه، «تأخیر» محسوب می‌شه
export const STAGE_DELAY_DAYS = 5;

const CLOSED_STATUSES = new Set(["DELIVERED", "CANCELLED", "RETURNED"]);

function latestShippedAt(order: DelayOrderInput): Date | null {
  const shipped = order.statusHistory.filter((h) => h.status === "SHIPPED");
  if (shipped.length === 0) return null;
  return shipped.reduce((latest, h) => (h.createdAt > latest ? h.createdAt : latest), shipped[0].createdAt);
}

// الان این سفارش توی کدوم مرحله‌ی «منتظر اقدام» گیر کرده؟ (برای سناریوی ۳)
function stuckStageReason(order: DelayOrderInput): string | null {
  if (order.status === "PENDING") return "سفارش هنوز توسط ادمین بررسی نشده";
  if (order.itemsNegotiationStatus === "AWAITING_ADMIN_REVIEW") return "منتظر بررسی پاسخ شما توسط ادمین";
  if (order.paymentStatus === "AWAITING_VERIFICATION") return "فیش پرداخت اقلام ارسال شده ولی هنوز توسط ادمین بررسی نشده";
  if (order.shippingPayment?.status === "AWAITING_VERIFICATION") return "فیش هزینه ارسال ارسال شده ولی هنوز توسط ادمین بررسی نشده";
  if (order.paymentStatus === "AWAITING_PAYMENT") return "منتظر واریز وجه توسط شما";
  if (
    order.status === "PROCESSING" &&
    order.paymentStatus === "PAID" &&
    order.hasExternalItems &&
    (!order.shippingPayment || order.shippingPayment.status !== "PAID")
  ) {
    return "در صف خرید -- منتظر خرید از ترندیول توسط ادمین";
  }
  return null;
}

function roughEta(order: DelayOrderInput, now: Date): EtaWindow {
  if (order.hasExternalItems) {
    // سفارش خارجی: خرید + ورود به انبار + پرداخت ارسال + ارسال داخلی
    return { from: addDays(now, 5), to: addDays(now, 12) };
  }
  const transit = carrierTransitDays(order.shippingMethod);
  return { from: addDays(now, 1 + transit.min), to: addDays(now, 1 + transit.max) };
}

export function computeDelayInfo(order: DelayOrderInput, now: Date = new Date()): DelayInfo {
  if (CLOSED_STATUSES.has(order.status)) return { delayed: false, reason: null, newEta: null };

  // سناریوی ۱: بسته برگشت خورده -- دقیق‌ترین دلیل
  const returned = [...order.statusHistory].reverse().find((h) => h.note?.includes("برگشت خورد"));
  if (returned) {
    const transit = carrierTransitDays(order.shippingMethod);
    return {
      delayed: true,
      reason: "بسته توسط پست/پیک برگشت خورد -- در حال آماده‌سازی ارسال مجدد",
      newEta: { from: addDays(now, 1 + transit.min), to: addDays(now, 1 + transit.max) },
    };
  }

  // سناریوی ۲: ارسال شده ولی ترانزیت رد شده
  if (order.status === "SHIPPED") {
    const transit = carrierTransitDays(order.shippingMethod);
    const anchor = latestShippedAt(order) ?? order.createdAt;
    const maxEta = addDays(anchor, transit.max);
    if (now.getTime() > maxEta.getTime()) {
      return {
        delayed: true,
        reason: "سفارش ارسال شده ولی هنوز تحویل داده نشده -- احتمالاً تأخیر در حمل/گمرک",
        newEta: { from: addDays(now, transit.min), to: addDays(now, transit.max) },
      };
    }
    return { delayed: false, reason: null, newEta: null };
  }

  // سناریوی ۳: گیر در یک مرحله و زمانش گذشته
  const reason = stuckStageReason(order);
  if (reason && now.getTime() - order.createdAt.getTime() > STAGE_DELAY_DAYS * 24 * 60 * 60 * 1000) {
    return { delayed: true, reason, newEta: roughEta(order, now) };
  }

  return { delayed: false, reason: null, newEta: null };
}
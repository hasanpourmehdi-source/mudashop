import { getSiteSettings, SITE_SETTING_KEYS } from "@/lib/siteSettings";

// یک سفارش در هر لحظه حداکثر توی یکی از این «مراحل نیازمند اقدام» می‌تونه
// باشه -- هرکدوم یعنی الان نوبت کیه که کاری بکنه و از چه زمانی منتظره
export type OrderStage =
  | "AWAITING_FIRST_REVIEW"
  | "AWAITING_ITEM_PAYMENT_REVIEW"
  | "AWAITING_SHIPPING_PAYMENT_REVIEW"
  | "AWAITING_PURCHASE"
  | "AWAITING_ADMIN_ITEMS_REVIEW"
  | "SHIPPED_TOO_LONG"
  | "AWAITING_RETURN_REVIEW";

export const STAGE_LABELS: Record<OrderStage, string> = {
  AWAITING_FIRST_REVIEW: "سفارش جدید -- هنوز باز نشده",
  AWAITING_ITEM_PAYMENT_REVIEW: "منتظر بررسی فیش پرداخت اقلام",
  AWAITING_SHIPPING_PAYMENT_REVIEW: "منتظر بررسی فیش هزینه ارسال/باربری",
  AWAITING_PURCHASE: "در صف خرید (منتظر خرید از ترندیول توسط ادمین)",
  AWAITING_ADMIN_ITEMS_REVIEW: "منتظر بررسی پاسخ مشتری به تغییر اقلام",
  SHIPPED_TOO_LONG: "ارسال شده -- مدتی از ارسالش گذشته",
  AWAITING_RETURN_REVIEW: "درخواست مرجوعی -- منتظر بررسی ادمین",
};

export type OrderAlertLevel = "none" | "warn" | "alert";

export type AlertableOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  itemsNegotiationStatus: string;
  itemsNegotiationRespondedAt: Date | null;
  paidAt: Date | null;
  receiptSubmittedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  items: { source: string }[];
  shippingPayment: { status: string; receiptSubmittedAt: Date | null } | null;
  statusHistory: { status: string; createdAt: Date }[];
  returnRequest: { status: string; updatedAt: Date } | null;
};

export type OrderAlertInfo = {
  stage: OrderStage | null;
  since: Date | null;
  hoursSince: number | null;
  level: OrderAlertLevel;
};

export type AlertThresholds = Record<OrderStage, { warnHours: number; alertHours: number }>;

const STAGE_THRESHOLD_KEYS: Record<OrderStage, { warn: string; alert: string }> = {
  AWAITING_FIRST_REVIEW: {
    warn: SITE_SETTING_KEYS.ALERT_FIRST_REVIEW_WARN_H,
    alert: SITE_SETTING_KEYS.ALERT_FIRST_REVIEW_ALERT_H,
  },
  AWAITING_ITEM_PAYMENT_REVIEW: {
    warn: SITE_SETTING_KEYS.ALERT_ITEM_PAYMENT_REVIEW_WARN_H,
    alert: SITE_SETTING_KEYS.ALERT_ITEM_PAYMENT_REVIEW_ALERT_H,
  },
  AWAITING_SHIPPING_PAYMENT_REVIEW: {
    warn: SITE_SETTING_KEYS.ALERT_SHIPPING_PAYMENT_REVIEW_WARN_H,
    alert: SITE_SETTING_KEYS.ALERT_SHIPPING_PAYMENT_REVIEW_ALERT_H,
  },
  AWAITING_PURCHASE: {
    warn: SITE_SETTING_KEYS.ALERT_AWAITING_PURCHASE_WARN_H,
    alert: SITE_SETTING_KEYS.ALERT_AWAITING_PURCHASE_ALERT_H,
  },
  AWAITING_ADMIN_ITEMS_REVIEW: {
    warn: SITE_SETTING_KEYS.ALERT_ADMIN_ITEMS_REVIEW_WARN_H,
    alert: SITE_SETTING_KEYS.ALERT_ADMIN_ITEMS_REVIEW_ALERT_H,
  },
  SHIPPED_TOO_LONG: {
    warn: SITE_SETTING_KEYS.ALERT_SHIPPED_TOO_LONG_WARN_H,
    alert: SITE_SETTING_KEYS.ALERT_SHIPPED_TOO_LONG_ALERT_H,
  },
  AWAITING_RETURN_REVIEW: {
    warn: SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_WARN_H,
    alert: SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_ALERT_H,
  },
};

// همه‌ی آستانه‌ها رو یک‌جا (نه هر سفارش جدا) می‌گیره -- برای داشبورد که
// دهاتها سفارش رو با هم بررسی می‌کنه، لازمه فقط یک بار fetch بشه
export async function loadAlertThresholds(): Promise<AlertThresholds> {
  const allKeys = Object.values(STAGE_THRESHOLD_KEYS).flatMap((k) => [k.warn, k.alert]);
  const settings = await getSiteSettings(allKeys);
  const result = {} as AlertThresholds;
  for (const [stage, keys] of Object.entries(STAGE_THRESHOLD_KEYS) as [OrderStage, { warn: string; alert: string }][]) {
    result[stage] = {
      warnHours: Number(settings[keys.warn]) || 0,
      alertHours: Number(settings[keys.alert]) || Infinity,
    };
  }
  return result;
}

function findLatestHistoryDate(history: { status: string; createdAt: Date }[], status: string): Date | null {
  const matches = history.filter((h) => h.status === status);
  if (matches.length === 0) return null;
  return matches.reduce((latest, h) => (h.createdAt > latest ? h.createdAt : latest), matches[0].createdAt);
}

// تشخیص می‌ده الان این سفارش (اگه واقعاً منتظر یه اقدامه) توی کدوم مرحله‌ست و
// از چه زمانی -- سفارش‌های عادی/بسته‌شده (لغو/تحویل/مرجوع) هیچ مرحله‌ای ندارن
export function determineOrderStage(order: AlertableOrder): { stage: OrderStage | null; since: Date | null } {
  // درخواست مرجوعی حتی روی سفارش «تحویل‌داده‌شده» هم می‌تونه نیازمند اقدام
  // ادمین باشه -- پس قبل از early-return برای DELIVERED چک می‌شه. REJECTED رو
  // عمداً نمی‌آریم این‌جا -- یعنی ادمین قبلاً تصمیمش رو گرفته و چیزی «منتظر»
  // نیست (برخلاف APPROVED که هنوز منتظر رسیدن/بررسیِ کالای برگشتیه)
  if (order.returnRequest && ["PENDING", "APPROVED", "ITEM_RECEIVED"].includes(order.returnRequest.status)) {
    return { stage: "AWAITING_RETURN_REVIEW", since: order.returnRequest.updatedAt };
  }
  if (["CANCELLED", "DELIVERED", "RETURNED"].includes(order.status)) {
    return { stage: null, since: null };
  }
  if (order.status === "PENDING") {
    return { stage: "AWAITING_FIRST_REVIEW", since: order.createdAt };
  }
  if (order.itemsNegotiationStatus === "AWAITING_ADMIN_REVIEW") {
    return { stage: "AWAITING_ADMIN_ITEMS_REVIEW", since: order.itemsNegotiationRespondedAt ?? order.updatedAt };
  }
  if (order.paymentStatus === "AWAITING_VERIFICATION") {
    return { stage: "AWAITING_ITEM_PAYMENT_REVIEW", since: order.receiptSubmittedAt ?? order.updatedAt };
  }
  if (order.shippingPayment?.status === "AWAITING_VERIFICATION") {
    return {
      stage: "AWAITING_SHIPPING_PAYMENT_REVIEW",
      since: order.shippingPayment.receiptSubmittedAt ?? order.updatedAt,
    };
  }
  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");
  if (
    order.status === "PROCESSING" &&
    order.paymentStatus === "PAID" &&
    hasExternalItems &&
    (!order.shippingPayment || order.shippingPayment.status !== "PAID")
  ) {
    return { stage: "AWAITING_PURCHASE", since: order.paidAt };
  }
  if (order.status === "SHIPPED") {
    return { stage: "SHIPPED_TOO_LONG", since: findLatestHistoryDate(order.statusHistory, "SHIPPED") };
  }
  return { stage: null, since: null };
}

export function computeOrderAlert(
  order: AlertableOrder,
  thresholds: AlertThresholds,
  now: Date = new Date()
): OrderAlertInfo {
  const { stage, since } = determineOrderStage(order);
  if (!stage || !since) return { stage, since, hoursSince: null, level: "none" };
  const hoursSince = (now.getTime() - since.getTime()) / (1000 * 60 * 60);
  const { warnHours, alertHours } = thresholds[stage];
  const level: OrderAlertLevel = hoursSince >= alertHours ? "alert" : hoursSince >= warnHours ? "warn" : "none";
  return { stage, since, hoursSince, level };
}

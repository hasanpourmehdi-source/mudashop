// ثابت‌های رویدادهای اعلان — بدون وابستگی به web-push/prisma تا در کامپوننت‌های
// سروری/کلاینت قابل ایمپورت باشد بدونِ باندلِ کتابخانه‌های Node-only
export const NOTIFICATION_EVENTS = [
  "ORDER_CREATED",
  "PAYMENT_RECEIVED",
  "PAYMENT_DEADLINE",
  "ORDER_SHIPPED",
  "PACKAGE_DELIVERED",
  "ORDER_DELAYED",
  "ORDER_CANCELLED",
  "RETURN_SUBMITTED",
  "RETURN_DECIDED",
  "SUPPORT_REPLY",
  "WALLET_CREDIT",
  "STOCK_BACK",
  "PRICE_DROP",
  "NEW_DEVICE_LOGIN",
  "CART_ABANDONED",
  "REFERRAL_REWARD",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  ORDER_CREATED: "ثبت سفارش",
  PAYMENT_RECEIVED: "تأیید پرداخت",
  PAYMENT_DEADLINE: "یادآوری مهلت پرداخت",
  ORDER_SHIPPED: "ارسال سفارش",
  PACKAGE_DELIVERED: "تحویل بسته",
  ORDER_DELAYED: "تأخیر در سفارش",
  ORDER_CANCELLED: "لغو سفارش",
  RETURN_SUBMITTED: "ثبت درخواست مرجوعی",
  RETURN_DECIDED: "نتیجه درخواست مرجوعی",
  SUPPORT_REPLY: "پاسخ پشتیبانی",
  WALLET_CREDIT: "شارژ کیف پول",
  STOCK_BACK: "موجودی محصول",
  PRICE_DROP: "کاهش قیمت",
  NEW_DEVICE_LOGIN: "ورود از دستگاه جدید",
  CART_ABANDONED: "یادآوری سبد خرید",
  REFERRAL_REWARD: "پاداش کد معرفی",
};
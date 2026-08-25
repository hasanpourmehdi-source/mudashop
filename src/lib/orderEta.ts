// تخمین زمان تحویل (ETA). چون فیلد جداگانه‌ای برای «زمان ارسال» نداریم، برای
// سفارش‌های ارسال‌شده از آخرین رویداد SHIPPED توی statusHistory استفاده می‌کنیم
// و ترانزیتِ (حداقل/حداکثر روز) شرکت باربری رو بهش اضافه می‌کنیم. برای سفارش‌های
// هنوز ارسال‌نشده، یه پنجره‌ی تقریبی از امروز می‌دیم.
export type CarrierTransit = { min: number; max: number };

export function carrierTransitDays(shippingMethod: string | null | undefined): CarrierTransit {
  const m = shippingMethod?.trim() ?? "";
  if (m === "پیک موتوری") return { min: 0, max: 1 };
  if (m.includes("تیپاکس")) return { min: 2, max: 4 };
  if (m.includes("پست سفارشی")) return { min: 5, max: 8 };
  // پست پیشتاز (یا پیش‌فرض)
  return { min: 3, max: 5 };
}

export type EtaOrderInput = {
  status: string;
  shippingMethod: string | null;
  hasExternalItems: boolean;
  createdAt: Date;
  statusHistory: { status: string; createdAt: Date }[];
};

export type EtaWindow = { from: Date; to: Date };

function addDays(d: Date, days: number): Date {
  const result = new Date(d.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export { addDays };

function latestShippedAt(order: EtaOrderInput): Date | null {
  const shipped = order.statusHistory.filter((h) => h.status === "SHIPPED");
  if (shipped.length === 0) return null;
  return shipped.reduce((latest, h) => (h.createdAt > latest ? h.createdAt : latest), shipped[0].createdAt);
}

const CLOSED_STATUSES = new Set(["DELIVERED", "CANCELLED", "RETURNED"]);

// پنجره‌ی تخمینی تحویل؛ برای سفارش بسته/تحویل‌داده‌شده null برمی‌گردونه (دیگه
// انتظاری نیست). برای ارسال‌شده، به زمان ارسالِ واقعی لنگر می‌گیره (ثابت می‌مونه)؛
// برای ارسال‌نشده، تقریبی از امروز جلو می‌ره
export function estimateDeliveryWindow(order: EtaOrderInput, now: Date = new Date()): EtaWindow | null {
  if (CLOSED_STATUSES.has(order.status)) return null;

  const transit = carrierTransitDays(order.shippingMethod);

  if (order.status === "SHIPPED") {
    const anchor = latestShippedAt(order) ?? order.createdAt;
    return { from: addDays(anchor, transit.min), to: addDays(anchor, transit.max) };
  }

  // هنوز ارسال نشده
  if (order.hasExternalItems) {
    // سفارش خارجی: خرید از ترندیول + ورود به انبار + پرداخت ارسال + ارسال داخلی
    // -- پنجره‌ی تقریبی ۵ تا ۱۲ روز از حالا
    return { from: addDays(now, 5), to: addDays(now, 12) };
  }

  // سفارش مزون: حدود ۱ روز آماده‌سازی + ترانزیت شرکت باربری
  return { from: addDays(now, 1 + transit.min), to: addDays(now, 1 + transit.max) };
}

export function formatEta(eta: EtaWindow): string {
  const fmt = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long" });
  return `${fmt.format(eta.from)} تا ${fmt.format(eta.to)}`;
}
export const SHIPPING_COST = 45000; // تومان
export const FREE_SHIPPING_THRESHOLD = 1500000; // تومان
export const GIFT_WRAP_COST = 25000; // تومان

export function calculateShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
}

// نحوه‌ی ارسال فقط برای سفارش‌های فقط-مزون معناداره -- برای سفارش‌های حاوی
// کالای خارجی (ترندیول)، هزینه/نحوه‌ی ارسال بعد از خرید و وزن‌کشی مشخص می‌شه
export const SHIPPING_METHODS = ["پست پیشتاز", "پست سفارشی", "تیپاکس", "پیک موتوری"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

// این روش‌ها هزینه‌شون مستقیم توسط مشتری به تحویل‌دهنده پرداخت می‌شه -- توی
// سایت نیازی به وارد کردن هزینه/تخصیص کارت برای بخش ارسال نیست
export const NO_COST_SHIPPING_METHODS: ShippingMethod[] = ["پیک موتوری", "تیپاکس"];

const COURIER_METHOD: ShippingMethod = "پیک موتوری";

// پیک موتوری فقط برای آدرس‌های داخل شهر تهران در دسترسه -- چون فیلد شهر آزاده
// (نه از یه لیست ثابت)، مقایسه‌ی دقیق رشته انجام می‌شه
export function isTehranCity(city: string): boolean {
  return city.trim() === "تهران";
}

export function availableShippingMethods(city: string): ShippingMethod[] {
  return isTehranCity(city)
    ? [...SHIPPING_METHODS]
    : SHIPPING_METHODS.filter((m) => m !== COURIER_METHOD);
}

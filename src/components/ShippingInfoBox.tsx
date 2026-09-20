import { SHIPPING_COST, FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from "@/lib/shipping";
import { carrierTransitDays } from "@/lib/orderEta";

// بازه‌ی روزِ تحویلِ مزون از رویِ همون منطقِ واقعیِ orderEta.ts محاسبه می‌شه --
// از سریع‌ترین روش (پیک موتوری) تا کندترین (پست سفارشی)، چون توی صفحه‌ی
// محصول هنوز معلوم نیست مشتری کدوم روش/شهر رو انتخاب می‌کنه
const mazonDeliveryDays = SHIPPING_METHODS.reduce(
  (acc, method) => {
    const transit = carrierTransitDays(method);
    return {
      min: Math.min(acc.min, 1 + transit.min),
      max: Math.max(acc.max, 1 + transit.max),
    };
  },
  { min: Infinity, max: -Infinity }
);

// هزینه/زمانِ ارسال کنارِ دکمه‌ی خرید -- مزون عددِ واقعی داره، ترندیول چون
// هزینه‌ی باربری قبل از خرید معلوم نیست، به‌جاش توضیح صادقانه + بازه‌ی تقریبی
export function ShippingInfoBox({
  variant,
  enabled,
}: {
  variant: "mazon" | "trendyol";
  enabled: boolean;
}) {
  if (!enabled) return null;

  if (variant === "trendyol") {
    return (
      <p className="text-[11px] text-[var(--color-muted)] mb-3">
        🚚 هزینه‌ی باربریِ این کالا بعد از خرید و وزن‌کشی مشخص می‌شه و قبل از پرداختِ نهایی بهت
        نشون داده می‌شه · زمانِ تقریبیِ رسیدن: ۵ تا ۱۲ روزِ کاری
      </p>
    );
  }

  return (
    <p className="text-[11px] text-[var(--color-muted)] mb-3">
      🚚 هزینه‌ی ارسال {SHIPPING_COST.toLocaleString("fa-IR")} تومان (رایگان برای خریدِ بالای{" "}
      {FREE_SHIPPING_THRESHOLD.toLocaleString("fa-IR")} تومان) · تحویل تقریبی{" "}
      {mazonDeliveryDays.min.toLocaleString("fa-IR")} تا {mazonDeliveryDays.max.toLocaleString("fa-IR")}{" "}
      روزِ کاری
    </p>
  );
}

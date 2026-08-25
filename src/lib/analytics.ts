"use client";

// ارسالِ رویدادهای استانداردِ فروشگاهی به گوگل آنالیتیکس (GA4) و متا پیکسل --
// همزمان، فقط اگه اسکریپتِ همون پلتفرم واقعاً لود شده باشه (بدون
// NEXT_PUBLIC_GA_MEASUREMENT_ID / NEXT_PUBLIC_META_PIXEL_ID در .env، این
// توابع کاملاً بی‌اثرن، نه خطا می‌دن نه چیزی می‌فرستن). بدون این، اگه توی
// اینستاگرام/گوگل تبلیغ بدی، نمی‌تونی بفهمی کدوم تبلیغ واقعاً به فروش تبدیل
// شده یا ریتارگتینگ بزنی.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

// قیمت‌های خودِ سایت به تومانه؛ GA4/متا کدِ ارزِ ایزو ۴۲۱۷ می‌خوان (نه «تومان»)
// -- ریال ۱۰ برابرِ تومانه، پس برای گزارشِ درستِ مبلغ به همون واحدِ رسمی تبدیل می‌کنیم
const TOMAN_TO_RIAL = 10;
const CURRENCY = "IRR";

export type AnalyticsItem = {
  id: string;
  title: string;
  price: number; // تومان
  quantity?: number;
};

function ga4Items(items: AnalyticsItem[]) {
  return items.map((i) => ({
    item_id: i.id,
    item_name: i.title,
    price: i.price * TOMAN_TO_RIAL,
    quantity: i.quantity ?? 1,
  }));
}

function totalValueRial(items: AnalyticsItem[]): number {
  return items.reduce((sum, i) => sum + i.price * (i.quantity ?? 1), 0) * TOMAN_TO_RIAL;
}

export function trackViewItem(item: AnalyticsItem): void {
  window.gtag?.("event", "view_item", {
    currency: CURRENCY,
    value: item.price * TOMAN_TO_RIAL,
    items: ga4Items([item]),
  });
  window.fbq?.("track", "ViewContent", {
    content_ids: [item.id],
    content_name: item.title,
    value: item.price * TOMAN_TO_RIAL,
    currency: CURRENCY,
  });
}

export function trackAddToCart(item: AnalyticsItem): void {
  window.gtag?.("event", "add_to_cart", {
    currency: CURRENCY,
    value: item.price * TOMAN_TO_RIAL * (item.quantity ?? 1),
    items: ga4Items([item]),
  });
  window.fbq?.("track", "AddToCart", {
    content_ids: [item.id],
    content_name: item.title,
    value: item.price * TOMAN_TO_RIAL * (item.quantity ?? 1),
    currency: CURRENCY,
  });
}

export function trackBeginCheckout(items: AnalyticsItem[]): void {
  window.gtag?.("event", "begin_checkout", {
    currency: CURRENCY,
    value: totalValueRial(items),
    items: ga4Items(items),
  });
  window.fbq?.("track", "InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    value: totalValueRial(items),
    currency: CURRENCY,
    num_items: items.reduce((sum, i) => sum + (i.quantity ?? 1), 0),
  });
}

export function trackPurchase(orderId: string, items: AnalyticsItem[], totalToman: number): void {
  window.gtag?.("event", "purchase", {
    transaction_id: orderId,
    currency: CURRENCY,
    value: totalToman * TOMAN_TO_RIAL,
    items: ga4Items(items),
  });
  window.fbq?.("track", "Purchase", {
    content_ids: items.map((i) => i.id),
    value: totalToman * TOMAN_TO_RIAL,
    currency: CURRENCY,
  });
}

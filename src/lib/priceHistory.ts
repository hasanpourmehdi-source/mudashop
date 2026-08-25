// ================= تاریخچه قیمت محصول =================
// عکس‌های قیمت (PriceSnapshot) قبلاً حداکثر یک بار در روز ثبت می‌شوند. این
// فایل فقط نمایش را می‌سازد: روزانه‌کردن، نمونه‌برداری برای نمودار و آمار
// (کمترین/بیشترین/میانگین). خالص و بدون DB -- برای تست.

export type PriceHistoryPoint = { price: number; at: string }; // at: ISO

export type PriceHistorySummary = {
  points: PriceHistoryPoint[];
  min: number;
  max: number;
  avg: number;
  current: number;
  isLowest: boolean;
  isHighest: boolean;
  dayCount: number;
};

// از روی عکس‌های قیمت (مرتب‌شده‌ی صعودی) خلاصه‌ی تاریخچه می‌سازد:
// - هر روز یک نقطه (آخرین عکس همان روز) -- چون یک بار در روز ثبت می‌شود
// - اگر تعداد روزها از maxPoints بیشتر باشد، نمونه‌برداری یکنواخت می‌کند
//   (نقطه‌ی اول و آخر همیشه حفظ می‌شوند تا نمودار بازه‌ی کامل را نشان دهد)
export function buildPriceHistory(
  snapshots: { price: number; recordedAt: string }[],
  currentPrice: number,
  maxPoints = 40
): PriceHistorySummary {
  const dayMap = new Map<string, { price: number; at: string }>();
  for (const s of [...snapshots].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  )) {
    const day = new Date(s.recordedAt).toISOString().slice(0, 10);
    dayMap.set(day, { price: s.price, at: s.recordedAt });
  }

  const daily = [...dayMap.values()];
  const points =
    daily.length <= maxPoints
      ? daily
      : pickEvenly(daily, maxPoints);

  if (points.length === 0) {
    return {
      points,
      min: 0,
      max: 0,
      avg: 0,
      current: currentPrice,
      isLowest: false,
      isHighest: false,
      dayCount: 0,
    };
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  return {
    points,
    min,
    max,
    avg,
    current: currentPrice,
    isLowest: currentPrice <= min,
    isHighest: currentPrice >= max,
    dayCount: daily.length,
  };
}

// نمونه‌برداری یکنواخت: n عنصر از لیست، اول و آخر همیشه حفظ می‌شوند
export function pickEvenly<T>(list: T[], n: number): T[] {
  if (list.length <= n) return [...list];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (list.length - 1)) / (n - 1));
    out.push(list[idx]);
  }
  return out;
}
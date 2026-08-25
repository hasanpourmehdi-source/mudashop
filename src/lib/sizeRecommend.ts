// ================= پیشنهادِ سایز بر اساسِ قد/وزن =================
// از روی ردیف‌های عددیِ راهنمای سایز (SizeChartRow)، سایزی که بازه‌ی قد و وزنش
// با ورودیِ مشتری جفت می‌شه رو پیدا می‌کند. هر بازه اختیاری‌ست (بعضی برندها
// فقط قد یا فقط وزن می‌دن) -- یه بازه‌ی null یعنی «بدون محدودیت در این طرف».

export type SizeChartRowLike = {
  sizeLabel: string;
  minHeightCm: number | null;
  maxHeightCm: number | null;
  minWeightKg: number | null;
  maxWeightKg: number | null;
};

function inRange(value: number, min: number | null, max: number | null): boolean {
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

// از بین ردیف‌هایی که هم قد هم وزن (اگه بازه داشته باشن) جفت می‌شن، اولی رو
// برمی‌گردونه. اگه هیچ‌کدوم دقیقاً جفت نشد، نزدیک‌ترین (بر اساس فاصله‌ی وسطِ
// بازه‌ی قد) رو به‌عنوان تخمین برمی‌گردونه -- بهتر از هیچ پیشنهادی
export function recommendSize(
  rows: SizeChartRowLike[],
  heightCm: number,
  weightKg: number
): { sizeLabel: string; exact: boolean } | null {
  if (rows.length === 0) return null;

  const exact = rows.find(
    (r) => inRange(heightCm, r.minHeightCm, r.maxHeightCm) && inRange(weightKg, r.minWeightKg, r.maxWeightKg)
  );
  if (exact) return { sizeLabel: exact.sizeLabel, exact: true };

  // تخمین: نزدیک‌ترین بازه‌ی قد (فاصله تا وسطِ بازه)؛ ردیف‌های بدون بازه‌ی قد نادیده گرفته می‌شن
  const withHeight = rows.filter((r) => r.minHeightCm != null || r.maxHeightCm != null);
  if (withHeight.length === 0) return null;

  let best = withHeight[0];
  let bestDist = Infinity;
  for (const r of withHeight) {
    const mid = ((r.minHeightCm ?? r.maxHeightCm!) + (r.maxHeightCm ?? r.minHeightCm!)) / 2;
    const dist = Math.abs(heightCm - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }
  return { sizeLabel: best.sizeLabel, exact: false };
}

// ================= تجمیعِ مرسوله / خریدِ گروهی =================
// چند قلمِ «خریداری‌شده» (احتمالاً از سفارش‌های مختلف) که با هم وزن‌کشی و
// ارسال می‌شن -- هزینه‌ی باربریِ کلِ محموله بر اساسِ سهمِ وزنیِ هر قلم تقسیم
// می‌شه، به‌جای این‌که هر سفارش هزینه‌ی ارسالِ کامل و جدا بپردازد.

export type ShipmentItemLike = { id: string; weightGrams: number };

// روش «باقی‌مانده‌ی بزرگ‌تر» (largest remainder) -- جمعِ سهم‌ها همیشه دقیقاً
// برابرِ totalCargoCost می‌مونه (برخلاف رُندکردنِ ساده که چند تومان کم/زیاد می‌کنه)
export function splitCargoCostByWeight(
  items: ShipmentItemLike[],
  totalCargoCost: number
): Map<string, number> {
  const result = new Map<string, number>();
  const totalWeight = items.reduce((sum, i) => sum + i.weightGrams, 0);
  if (items.length === 0 || totalWeight <= 0) return result;

  const shares = items.map((i) => ({
    id: i.id,
    raw: (i.weightGrams / totalWeight) * totalCargoCost,
  }));

  let assigned = 0;
  for (const s of shares) {
    const floor = Math.floor(s.raw);
    result.set(s.id, floor);
    assigned += floor;
  }

  // تومان‌های باقی‌مانده (به‌خاطر رُندکردن) به بزرگ‌ترین باقی‌مانده‌های اعشاری داده می‌شه
  const remainder = totalCargoCost - assigned;
  const byFraction = shares
    .map((s) => ({ id: s.id, frac: s.raw - Math.floor(s.raw) }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i++) {
    const id = byFraction[i % byFraction.length].id;
    result.set(id, (result.get(id) ?? 0) + 1);
  }

  return result;
}

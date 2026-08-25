// ================= امتیاز/سطحِ وفاداریِ واقعی =================
// علاوه‌بر کسراژِ ریالی (که در siteSettings.LOYALTY_CASHBACK_PERCENT پایه‌ست)،
// هر تومانِ خرید امتیاز هم می‌سازه؛ جمعِ امتیازها یه سطح (برنز/نقره/طلا) تعیین
// می‌کند که به کسراژِ پایه یه درصدِ اضافه می‌دهد -- یعنی هرچی بیشتر خرید کنی،
// درصدِ برگشتی‌ات هم بیشتر می‌شه.

// هر ۱۰٬۰۰۰ تومانِ پرداختی، ۱ امتیاز
const TOMAN_PER_POINT = 10_000;

export function computeLoyaltyPointsEarned(paidAmount: number): number {
  if (paidAmount <= 0) return 0;
  return Math.floor(paidAmount / TOMAN_PER_POINT);
}

export type LoyaltyTier = { key: "BRONZE" | "SILVER" | "GOLD"; label: string; minPoints: number; bonusPercent: number };

export const LOYALTY_TIERS: LoyaltyTier[] = [
  { key: "GOLD", label: "طلایی", minPoints: 2000, bonusPercent: 2 },
  { key: "SILVER", label: "نقره‌ای", minPoints: 500, bonusPercent: 1 },
  { key: "BRONZE", label: "برنزی", minPoints: 0, bonusPercent: 0 },
];

export function getLoyaltyTier(points: number): LoyaltyTier {
  return LOYALTY_TIERS.find((t) => points >= t.minPoints) ?? LOYALTY_TIERS[LOYALTY_TIERS.length - 1];
}

// امتیازِ لازم برای رسیدن به سطحِ بعدی؛ null یعنی همین الان بالاترین سطحه
export function pointsToNextTier(points: number): number | null {
  const current = getLoyaltyTier(points);
  const currentIndex = LOYALTY_TIERS.findIndex((t) => t.key === current.key);
  const next = LOYALTY_TIERS[currentIndex - 1];
  return next ? next.minPoints - points : null;
}

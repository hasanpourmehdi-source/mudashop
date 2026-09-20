import { SITE_SETTING_KEYS, getSiteSettings } from "@/lib/siteSettings";

// ================= امتیاز/سطحِ وفاداریِ واقعی =================
// علاوه‌بر کسراژِ ریالی (که در siteSettings.LOYALTY_CASHBACK_PERCENT پایه‌ست)،
// هر تومانِ خرید امتیاز هم می‌سازه؛ جمعِ امتیازها یه سطح (برنز/نقره/طلا) تعیین
// می‌کند که به کسراژِ پایه یه درصدِ اضافه می‌دهد -- یعنی هرچی بیشتر خرید کنی،
// درصدِ برگشتی‌ات هم بیشتر می‌شه. نرخ/آستانه‌ها/پاداش‌ها همه از تنظیماتِ ادمین
// میان (این فایل فقط توابعِ خالص رو نگه می‌داره، فچِ تنظیمات توی getLoyaltyConfig)

export type LoyaltyTier = {
  key: "BRONZE" | "SILVER" | "GOLD";
  label: string;
  minPoints: number;
  bonusPercent: number;
  freeShipping: boolean; // مزیتِ باشگاه -- ارسالِ رایگانِ نامحدود (فقط سفارشِ بدونِ کالای خارجی)
};

export type LoyaltyConfig = { tomanPerPoint: number; tiers: LoyaltyTier[] };

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  const raw = await getSiteSettings([
    SITE_SETTING_KEYS.LOYALTY_TOMAN_PER_POINT,
    SITE_SETTING_KEYS.LOYALTY_SILVER_MIN_POINTS,
    SITE_SETTING_KEYS.LOYALTY_SILVER_BONUS_PERCENT,
    SITE_SETTING_KEYS.LOYALTY_GOLD_MIN_POINTS,
    SITE_SETTING_KEYS.LOYALTY_GOLD_BONUS_PERCENT,
    SITE_SETTING_KEYS.LOYALTY_SILVER_FREE_SHIPPING,
    SITE_SETTING_KEYS.LOYALTY_GOLD_FREE_SHIPPING,
  ]);

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const tomanPerPoint = num(raw[SITE_SETTING_KEYS.LOYALTY_TOMAN_PER_POINT], 10_000) || 10_000;
  const silverMin = num(raw[SITE_SETTING_KEYS.LOYALTY_SILVER_MIN_POINTS], 500);
  const silverBonus = num(raw[SITE_SETTING_KEYS.LOYALTY_SILVER_BONUS_PERCENT], 1);
  const goldMin = num(raw[SITE_SETTING_KEYS.LOYALTY_GOLD_MIN_POINTS], 2000);
  const goldBonus = num(raw[SITE_SETTING_KEYS.LOYALTY_GOLD_BONUS_PERCENT], 2);
  const silverFreeShipping = raw[SITE_SETTING_KEYS.LOYALTY_SILVER_FREE_SHIPPING] === "true";
  const goldFreeShipping = raw[SITE_SETTING_KEYS.LOYALTY_GOLD_FREE_SHIPPING] === "true";

  return {
    tomanPerPoint,
    tiers: [
      { key: "GOLD", label: "طلایی", minPoints: goldMin, bonusPercent: goldBonus, freeShipping: goldFreeShipping },
      { key: "SILVER", label: "نقره‌ای", minPoints: silverMin, bonusPercent: silverBonus, freeShipping: silverFreeShipping },
      { key: "BRONZE", label: "برنزی", minPoints: 0, bonusPercent: 0, freeShipping: false },
    ],
  };
}

export function computeLoyaltyPointsEarned(paidAmount: number, tomanPerPoint: number): number {
  if (paidAmount <= 0) return 0;
  return Math.floor(paidAmount / tomanPerPoint);
}

export function getLoyaltyTier(points: number, tiers: LoyaltyTier[]): LoyaltyTier {
  return tiers.find((t) => points >= t.minPoints) ?? tiers[tiers.length - 1];
}

// امتیازِ لازم برای رسیدن به سطحِ بعدی؛ null یعنی همین الان بالاترین سطحه
export function pointsToNextTier(points: number, tiers: LoyaltyTier[]): number | null {
  const current = getLoyaltyTier(points, tiers);
  const currentIndex = tiers.findIndex((t) => t.key === current.key);
  const next = tiers[currentIndex - 1];
  return next ? next.minPoints - points : null;
}

import { prisma } from "@/lib/prisma";

export type AvailableCoupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIP" | "FIRST_BUY";
  value: number;
  minOrderAmount: number;
  expiresAt: Date | null;
};

// کدهای تخفیفی که همین الان برای این کاربر قابلِ استفاده‌ان -- برخلافِ سیستمِ
// کوپنِ خودِ ترندیول، اینجا کوپن به‌ازای هر کاربر «تخصیص» داده نمی‌شه؛ همه‌ی
// کدهای فعالِ عمومی به همه نشون داده می‌شن (دقیقاً همون چیزی که هرکسی می‌تونه
// موقعِ چک‌اوت وارد کنه)، پس این صفحه فقط یه لیستِ آماده و قابل‌کپی از همون
// کدهاست -- نه چیزِ شخصی‌سازی‌شده‌ی جدا.
// showcaseOnProducts=true یعنی ادمین صراحتاً خواسته این کد عمومی/تبلیغاتی
// باشه (نه یه کدِ خصوصیِ کمپینِ ایمیلی/معرفی) -- همون فیلدی که برای بجِ صفحه‌ی
// محصول هم استفاده می‌شه.
export async function fetchAvailableCouponsForUser(userId: string | null): Promise<AvailableCoupon[]> {
  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      showcaseOnProducts: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  const notExhausted = coupons.filter((c) => c.maxUses === null || c.usedCount < c.maxUses);

  // کدهای FIRST_BUY فقط برای کسی که هنوز هیچ سفارشِ (غیرِلغوشده‌ای) نداره معنی
  // داره -- دقیقاً همون چکی که خودِ api/coupons/validate موقعِ اعمالِ کد انجام می‌ده
  const hasPreviousOrders = userId
    ? (await prisma.order.count({ where: { userId, status: { not: "CANCELLED" } } })) > 0
    : false;

  return notExhausted
    .filter((c) => c.type !== "FIRST_BUY" || !hasPreviousOrders)
    .map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      minOrderAmount: c.minOrderAmount,
      expiresAt: c.expiresAt,
    }));
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLoyaltyCashbackPercent } from "@/lib/giftCard";
import { getLoyaltyTier, pointsToNextTier, getLoyaltyConfig } from "@/lib/loyaltyTier";
import { getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";

// خلاصه‌ی وفاداری کاربر: مانده‌ی کیف پول + کل کسراژ دریافتی + تاریخچه‌ی
// تراکنش‌های وفاداری و کارت هدیه + درصد کسراژ فعلی سایت
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const [wallet, user] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { loyaltyPoints: true } }),
  ]);

  const [transactions, percent, loyaltyConfig, enabled] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: {
        walletId: wallet?.id ?? "",
        type: { in: ["LOYALTY", "GIFT_CARD"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, type: true, amount: true, description: true, createdAt: true },
    }),
    getLoyaltyCashbackPercent(),
    getLoyaltyConfig(),
    getSiteSettingBool(SITE_SETTING_KEYS.LOYALTY_CASHBACK_ENABLED),
  ]);

  const totalLoyalty = transactions
    .filter((t) => t.type === "LOYALTY")
    .reduce((sum, t) => sum + t.amount, 0);

  const points = user?.loyaltyPoints ?? 0;
  const tier = getLoyaltyTier(points, loyaltyConfig.tiers);

  // نردبانِ کاملِ سطوح -- برای نمایشِ همه‌ی پله‌های باشگاه (نه فقط سطحِ فعلی)
  // توی صفحه‌ی مشتری، از پایین (برنزی) به بالا (طلایی) مرتب می‌شه
  const allTiers = [...loyaltyConfig.tiers].reverse().map((t) => ({
    key: t.key,
    label: t.label,
    minPoints: t.minPoints,
    cashbackPercent: percent + t.bonusPercent,
    freeShipping: t.freeShipping,
    isCurrent: t.key === tier.key,
  }));

  return NextResponse.json({
    enabled,
    balance: wallet?.balance ?? 0,
    cashbackPercent: percent + tier.bonusPercent,
    totalLoyalty,
    transactions,
    loyaltyPoints: points,
    tier: { key: tier.key, label: tier.label, bonusPercent: tier.bonusPercent, freeShipping: tier.freeShipping },
    pointsToNextTier: pointsToNextTier(points, loyaltyConfig.tiers),
    allTiers,
  });
}
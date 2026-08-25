import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLoyaltyCashbackPercent } from "@/lib/giftCard";
import { getLoyaltyTier, pointsToNextTier } from "@/lib/loyaltyTier";

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

  const [transactions, percent] = await Promise.all([
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
  ]);

  const totalLoyalty = transactions
    .filter((t) => t.type === "LOYALTY")
    .reduce((sum, t) => sum + t.amount, 0);

  const points = user?.loyaltyPoints ?? 0;
  const tier = getLoyaltyTier(points);

  return NextResponse.json({
    balance: wallet?.balance ?? 0,
    cashbackPercent: percent + tier.bonusPercent,
    totalLoyalty,
    transactions,
    loyaltyPoints: points,
    tier: { label: tier.label, bonusPercent: tier.bonusPercent },
    pointsToNextTier: pointsToNextTier(points),
  });
}
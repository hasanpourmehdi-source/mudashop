import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateReferralCode } from "@/lib/referral";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const [code, rewards, rewardAmount] = await Promise.all([
    getOrCreateReferralCode(session.user.id),
    prisma.referralReward.findMany({
      where: { referrerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { referred: { select: { name: true } } },
    }),
    getSiteSetting(SITE_SETTING_KEYS.REFERRAL_REWARD_AMOUNT),
  ]);

  return NextResponse.json({
    code,
    rewardAmount: Number(rewardAmount) || 0,
    rewards: rewards.map((r) => ({
      id: r.id,
      amount: r.rewardAmount,
      referredName: r.referred.name ?? "کاربری",
      createdAt: r.createdAt,
    })),
    totalEarned: rewards.reduce((sum, r) => sum + r.rewardAmount, 0),
  });
}

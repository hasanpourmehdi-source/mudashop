import { prisma } from "@/lib/prisma";

export type DiscoveredCampaignForDisplay = {
  campaignId: number;
  siteSlug: string;
  siteLabel: string; // «ترندیول» یا «میلا» -- برای نشون دادنِ منبع روی کارت
  text: string;
  sampleImage: string | null;
};

const STALE_AFTER_DAYS = 30;

// کمپین‌های واقعیِ ترندیول که هر بار محصولی روی خودِ سایت ما فچ شده کشف/به‌روز
// شدن (TrendyolDiscoveredCampaign) -- برای صفحه‌ی اصلی. کمپین‌هایی که واقعاً
// تمام شدن (endsAt گذشته) یا مدت‌هاست هیچ محصولی ازشون دیده نشده (lastSeenAt
// خیلی قدیمی -- یعنی به‌احتمال زیاد تمام شده ولی endsAt نداشتیم) نشون داده نمی‌شن
export async function fetchDiscoveredCampaignsForHomepage(limit = 8): Promise<DiscoveredCampaignForDisplay[]> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const rows = await prisma.trendyolDiscoveredCampaign.findMany({
    where: {
      lastSeenAt: { gte: staleThreshold },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    campaignId: r.campaignId,
    siteSlug: r.site === "TRENDYOL_MILLA" ? "trendyol-milla" : "trendyol",
    siteLabel: r.site === "TRENDYOL_MILLA" ? "میلا" : "ترندیول",
    text: r.text,
    sampleImage: r.sampleImage,
  }));
}

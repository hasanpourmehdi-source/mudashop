import { prisma } from "@/lib/prisma";

export type ActiveCampaign = {
  id: string;
  title: string;
  slug: string;
  bannerImage: string;
  description: string | null;
  endsAt: Date;
  brand: { id: string; name: string };
};

// کمپین‌هایی که همین الان توی بازه‌ی زمانی‌شون فعال هستن -- برای نمایش توی صفحه‌ی اصلی
export async function fetchActiveCampaigns(): Promise<ActiveCampaign[]> {
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    include: { brand: { select: { id: true, name: true } } },
    orderBy: { endsAt: "asc" },
  });
  return campaigns;
}

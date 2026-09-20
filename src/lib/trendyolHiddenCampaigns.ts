import { prisma } from "@/lib/prisma";

// آیدی‌هایی که ادمین با تیکِ «غیرفعال» (کنارِ ترجمه‌ی هر کمپین) خواسته کلاً
// نشون داده نشن -- کش می‌شه چون این چک برای هر کمپینِ هر محصول لازمه. همون
// مشکلِ چندinstanceیِ کش‌های دیگه‌ی همین پروژه اینجا هم هست (هر instanceِ
// گرمِ Vercel کپیِ جداگانه‌ی خودش رو داره، invalidate-روی-نوشتن به تنهایی
// کافی نیست) -- برای همین TTLِ کوتاه هم داره، نه فقط invalidate
const HIDDEN_CAMPAIGNS_CACHE_TTL_MS = 5 * 60 * 1000;
let hiddenCampaignIdsCache: Set<number> | null = null;
let hiddenCampaignIdsCacheExpiresAt = 0;

export function invalidateHiddenCampaignsCache() {
  hiddenCampaignIdsCache = null;
  hiddenCampaignIdsCacheExpiresAt = 0;
}

async function loadHiddenCampaignIds(): Promise<Set<number>> {
  if (hiddenCampaignIdsCache && hiddenCampaignIdsCacheExpiresAt > Date.now()) return hiddenCampaignIdsCache;
  const rows = await prisma.trendyolHiddenCampaign.findMany({ select: { campaignId: true } });
  const ids = new Set(rows.map((r) => r.campaignId));
  hiddenCampaignIdsCache = ids;
  hiddenCampaignIdsCacheExpiresAt = Date.now() + HIDDEN_CAMPAIGNS_CACHE_TTL_MS;
  return ids;
}

export async function filterOutHiddenCampaigns<T extends { id: number }>(badges: T[]): Promise<T[]> {
  if (badges.length === 0) return badges;
  const hiddenIds = await loadHiddenCampaignIds();
  if (hiddenIds.size === 0) return badges;
  return badges.filter((b) => !hiddenIds.has(b.id));
}

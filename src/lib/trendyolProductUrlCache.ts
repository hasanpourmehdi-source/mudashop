import { prisma } from "@/lib/prisma";

// ثبت/به‌روزرسانی نگاشت contentId -> آدرس کامل ترندیول -- صدا زده می‌شه هروقت
// یه لینک محصول واقعی (با contentId و url کامل) از جایی مثل TrendyolLiveGrid
// دیده می‌شه. best-effort: اگه ذخیره خطا داد، نباید کل ناوبری کاربر رو بترکونه.
export async function cacheTrendyolProductUrl(contentId: string, url: string): Promise<void> {
  if (!contentId || !url) return;
  try {
    await prisma.trendyolProductUrlCache.upsert({
      where: { contentId },
      create: { contentId, url },
      update: { url },
    });
  } catch (err) {
    console.error("خطا در کش کردن آدرس محصول ترندیول:", err);
  }
}

export async function getCachedTrendyolProductUrl(contentId: string): Promise<string | null> {
  const row = await prisma.trendyolProductUrlCache.findUnique({
    where: { contentId },
    select: { url: true },
  });
  return row?.url ?? null;
}

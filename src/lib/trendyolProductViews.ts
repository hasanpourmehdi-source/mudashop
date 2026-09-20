import { prisma } from "@/lib/prisma";

// ثبتِ یک بازدیدِ صفحه‌ی محصولِ ترندیول/میلا -- برای «نشانه‌ی اجتماعیِ لحظه‌ای»
// (چند نفر همین چند دقیقه‌ی اخیر این محصول رو دیدن). best-effort، نباید رندرِ
// صفحه رو کند/متوقف کنه
export async function recordTrendyolProductView(contentId: string) {
  await prisma.trendyolProductView.create({ data: { contentId } }).catch(() => {});
}

// تعدادِ بازدیدهای همین محصول توی N دقیقه‌ی اخیر -- عمداً «همین چند دقیقه»
// (نه ۲۴ ساعت مثلِ ProductView مزون) چون هدف حسِ لحظه‌ای/زنده‌ست
export async function fetchRecentTrendyolViewersCount(
  contentId: string,
  windowMinutes: number,
): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  return prisma.trendyolProductView.count({ where: { contentId, createdAt: { gte: since } } });
}

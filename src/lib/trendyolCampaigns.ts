import { prisma } from "@/lib/prisma";
import { toEnglishDigits } from "@/lib/turkishText";

export type DiscoveredCampaignForDisplay = {
  campaignId: number;
  siteSlug: string;
  siteLabel: string; // «ترندیول» یا «میلا» -- برای نشون دادنِ منبع روی کارت
  text: string;
  rawNameTr: string | null; // برای امکاناتِ ادمینِ صفحه‌ی کمپین (تعریف/ویرایشِ الگو) -- ردیف‌های قدیمی ندارنش
  sampleImage: string | null;
};

const STALE_AFTER_DAYS = 30;

// طبقِ درخواستِ صریح: لیستِ کمپین‌ها همیشه بر اساسِ درصدِ تخفیف از بیشترین به
// کمترین سورت بشه. خودِ متنِ فارسیِ کمپین (که از قبل توی دیتابیس ذخیره شده)
// تنها منبعیه که در دسترسه -- عددِ کنارِ «%» رو استخراج می‌کنیم. کمپین‌هایی که
// تخفیفشون مقدارِ مطلق به لیره (نه درصد، مثلِ «۴۰ لیر تخفیف») عددی برای سورت
// ندارن -- صفر در نظر گرفته می‌شن، یعنی انتهای لیست
function extractDiscountPercent(text: string): number {
  const match = toEnglishDigits(text).match(/(\d+)\s*%|%\s*(\d+)/);
  if (!match) return 0;
  return Number(match[1] ?? match[2]) || 0;
}

// کمپین‌های واقعیِ ترندیول که هر بار محصولی روی خودِ سایت ما فچ شده کشف/به‌روز
// شدن (TrendyolDiscoveredCampaign) -- برای صفحه‌ی اصلی. کمپین‌هایی که واقعاً
// تمام شدن (endsAt گذشته) یا مدت‌هاست هیچ محصولی ازشون دیده نشده (lastSeenAt
// خیلی قدیمی -- یعنی به‌احتمال زیاد تمام شده ولی endsAt نداشتیم) نشون داده نمی‌شن
export async function fetchDiscoveredCampaignsForHomepage(limit = 8): Promise<DiscoveredCampaignForDisplay[]> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  // یه استخرِ بزرگ‌تر از تازه‌ترین کمپین‌ها می‌گیریم (نه فقط limit تا) چون
  // سورت نهایی بر اساسِ درصدِ تخفیفه، نه lastSeenAt -- اگه همون‌جا محدود به
  // limit می‌شد، سورت فقط رویِ همون چندتای اول (که به ترتیبِ تازگی انتخاب
  // شدن) اعمال می‌شد، نه رویِ کل کمپین‌های فعالِ اخیر
  const rows = await prisma.trendyolDiscoveredCampaign.findMany({
    where: {
      lastSeenAt: { gte: staleThreshold },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { lastSeenAt: "desc" },
    take: Math.max(limit * 5, 50),
  });

  // خیلی از کمپین‌های سبدخریدِ عمومی (مثلِ «Sepette %70 İndirim») یه اسمِ کاملاً
  // یکسان دارن ولی campaignId هاشون واقعاً فرق می‌کنه (هرکدوم برای دسته/فروشنده/
  // بازه‌ی زمانیِ متفاوت) -- یعنی از نظرِ داده هیچ باگی نیست، ولی از نظرِ کاربر
  // که فقط متنِ کارت رو می‌بینه، عیناً تکراری به‌نظر می‌رسه. برای همین توی
  // نمایش (نه توی خودِ دیتابیس) بر اساسِ متن یکتاسازی می‌کنیم -- از هر متنِ
  // تکراری فقط تازه‌ترینش (که چون rows از قبل با lastSeenAt نزولی مرتبه، یعنی
  // همون اولین موردیه که به این متن می‌رسیم) نگه داشته می‌شه
  const seenTexts = new Set<string>();
  const deduped = rows.filter((r) => {
    if (seenTexts.has(r.text)) return false;
    seenTexts.add(r.text);
    return true;
  });

  const mapped = deduped.map((r) => ({
    campaignId: r.campaignId,
    siteSlug: r.site === "TRENDYOL_MILLA" ? "trendyol-milla" : "trendyol",
    siteLabel: r.site === "TRENDYOL_MILLA" ? "میلا" : "ترندیول",
    text: r.text,
    rawNameTr: r.rawNameTr,
    sampleImage: r.sampleImage,
    discountPercent: extractDiscountPercent(r.text),
  }));

  mapped.sort((a, b) => b.discountPercent - a.discountPercent);

  return mapped.slice(0, limit).map(({ discountPercent: _discountPercent, ...rest }) => rest);
}

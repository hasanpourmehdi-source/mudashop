// این جدول رو خالی می‌کنه (نه هیچ جدول دیگه‌ای) -- چون دیتای فعلیش با سیستم
// آیدی غلط (از API یکپارچه‌سازی محصول) پر شده بود، نه wc= واقعی. بعد از این،
// می‌تونی prisma db push رو بدون خطا بزنی. ترجمه‌ها جای نگرانی نیست: همه‌شون
// قبلاً به فرهنگ‌لغت دائمی (trendyolTranslationDictionary.ts) منتقل شدن و با
// «به‌روزرسانی همه»ی بعدی دوباره خودکار پیشنهاد داده می‌شن.
//
// اجرا: node prisma/clearTrendyolCategoryCache.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.trendyolCategoryCache.deleteMany({});
  console.log(`${result.count} ردیف از trendyol_category_cache پاک شد.`);
  console.log("حالا می‌تونی 'npx prisma db push' رو دوباره بزنی.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

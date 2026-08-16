// ردیف‌های گروه «فیات» (filterKey="Price") رو از TrendyolFilterCache پاک
// می‌کنه -- چون فیلتر قیمت الان آزاد (از/تا) شده و دیگه به این پیش‌فرض‌های
// ذخیره‌شده (و ترجمه‌هاشون) نیازی نداره. هیچ جدول/دیتای دیگه‌ای دست نمی‌خوره.
//
// اجرا: node prisma/clearPriceFilterCache.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.trendyolFilterCache.deleteMany({
    where: { filterKey: "Price" },
  });
  console.log(`${result.count} ردیف از trendyol_filter_cache (گروه «فیات») پاک شد.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

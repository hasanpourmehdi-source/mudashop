// همه‌ی ردیف‌های ExternalSiteCategoryParam (نگاشت دستی دسته‌بندی مزون -> wc=)
// مربوط به ترندیول و میلا رو پاک می‌کنه -- چون الان فیلتر دسته‌بندی سمت مشتری
// کاملاً از داده‌ی پویا (TrendyolCategoryCache، بر اساس جنسیت) میاد، نه از
// این نگاشت‌های دستی که همه‌شون هنوز placeholder (wc=0) بودن.
//
// خودِ مدل/مکانیزم دست‌نخورده می‌مونه -- اگه بعداً یه سایت خارجی دیگه اضافه
// شد که واقعاً بخواد از نگاشت دستی دسته‌بندی استفاده کنه، همون راه قبلی
// (پنل ادمین -> سایت‌های خارجی) هنوز کار می‌کنه.
//
// اجرا: node prisma/clearTrendyolCategoryParams.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TARGET_SLUGS = ["trendyol", "trendyol-milla"];

async function main() {
  const sites = await prisma.externalSite.findMany({
    where: { slug: { in: TARGET_SLUGS } },
  });

  if (sites.length === 0) {
    console.log("⚠️  هیچ سایتی با این اسلاگ‌ها پیدا نشد:", TARGET_SLUGS.join(", "));
    return;
  }

  for (const site of sites) {
    const result = await prisma.externalSiteCategoryParam.deleteMany({
      where: { siteId: site.id },
    });
    console.log(`${site.name} (${site.slug}): ${result.count} ردیف پاک شد.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

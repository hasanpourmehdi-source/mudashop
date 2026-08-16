// نگاشت‌های ExternalSiteAttributeParam (سایز، رنگ، متریال، ...) مربوط به
// ترندیول و میلا رو پاک می‌کنه -- به‌جز «جنسیت»، چون کل سیستم پویای فیلترها
// (دسته‌بندی، رنگ، برند، فیات، امتیاز، ...) دقیقاً بر اساس همون یه attribute
// فعال می‌شه. بقیه دیگه لازم نیستن چون همه‌شون مستقیم از aggregations زنده‌ی
// خودِ ترندیول میان، نه از این نگاشت‌های دستی مزون.
//
// اجرا: node prisma/clearLegacyTrendyolAttributeParams.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TARGET_SLUGS = ["trendyol", "trendyol-milla"];
const KEEP_ATTRIBUTE_NAME = "جنسیت";

async function main() {
  const sites = await prisma.externalSite.findMany({
    where: { slug: { in: TARGET_SLUGS } },
  });

  if (sites.length === 0) {
    console.log("⚠️  هیچ سایتی با این اسلاگ‌ها پیدا نشد:", TARGET_SLUGS.join(", "));
    return;
  }

  const genderAttribute = await prisma.attribute.findUnique({
    where: { name: KEEP_ATTRIBUTE_NAME },
  });

  for (const site of sites) {
    const result = await prisma.externalSiteAttributeParam.deleteMany({
      where: {
        siteId: site.id,
        ...(genderAttribute ? { attributeId: { not: genderAttribute.id } } : {}),
      },
    });
    console.log(`${site.name} (${site.slug}): ${result.count} ردیف پاک شد (جنسیت نگه داشته شد).`);
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

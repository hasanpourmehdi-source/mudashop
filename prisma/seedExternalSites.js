// اجرا: node prisma/seedExternalSites.js
//
// دو تا سایت خارجی (ترندیول، ترندیول‌میلا) رو با baseUrlشون می‌سازه، و تنها
// چیزی که واقعاً تست و تاییدشده (نگاشت جنسیت: wg=1 زنانه، wg=2 مردانه) رو
// براشون ثبت می‌کنه. پارامتر دسته‌بندی (wc=) و سایز (vr=) رو عمداً خالی
// می‌ذاره چون هنوز واقعاً تست نشدن -- باید از پنل ادمین دستی اضافه بشن.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function ensureSite(slug, name, baseUrl) {
  const existing = await prisma.externalSite.findUnique({ where: { slug } });
  if (existing) {
    await prisma.externalSite.update({ where: { slug }, data: { name, baseUrl } });
    console.log(`🔄 سایت «${name}» به‌روزرسانی شد`);
    return existing.id;
  }
  const created = await prisma.externalSite.create({ data: { slug, name, baseUrl } });
  console.log(`✅ سایت «${name}» ساخته شد`);
  return created.id;
}

async function ensureGenderMapping(siteId, attributeId, value, paramTemplate) {
  await prisma.externalSiteAttributeParam.upsert({
    where: { siteId_attributeId_value: { siteId, attributeId, value } },
    update: { paramTemplate },
    create: { siteId, attributeId, value, paramTemplate },
  });
  console.log(`  ↳ جنسیت=${value} -> ${paramTemplate}`);
}

async function main() {
  const genderAttr = await prisma.attribute.findUnique({ where: { name: "جنسیت" } });
  if (!genderAttr) {
    console.log("⚠️  ویژگی «جنسیت» پیدا نشد -- نگاشت جنسیت رد شد.");
  }

  const trendyolId = await ensureSite("trendyol", "ترندیول", "https://www.trendyol.com/sr?");
  const trendyolMillaId = await ensureSite(
    "trendyol-milla",
    "ترندیول میلا",
    "https://www.trendyol-milla.com/sr?"
  );

  if (genderAttr) {
    for (const siteId of [trendyolId, trendyolMillaId]) {
      await ensureGenderMapping(siteId, genderAttr.id, "زنانه", "wg=1");
      await ensureGenderMapping(siteId, genderAttr.id, "مردانه", "wg=2");
    }
  }

  console.log("انجام شد. حالا از پنل ادمین (سایت‌های خارجی) پارامتر دسته‌بندی و سایز رو اضافه کن.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// اجرا: node prisma/seedSizeSharedKey.js
//
// دیتای نمونه برای تست کامل مکانیزم «کلید مشترک» (sharedKey) روی سایت ترندیول:
// چندتا ویژگی مختلف (سایز لباس حرفی، سایز کفش عددی، سایز لباس عددی، سایز سنی،
// استاندارد) که همه باید زیر یه کلید مشترک "vr=size|" ترکیب بشن، هرکدوم با
// قالب تبدیل مقدار خودش -- دقیقاً طبق نمونه‌ی واقعی که از ترندیول دیدیم:
//   vr=size|group-l_group-xs-s_32_36-38_10-yas_standart

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function ensureAttribute(id, name, groupId, values) {
  const existing = await prisma.attribute.findUnique({ where: { id } });
  if (!existing) {
    await prisma.attribute.create({ data: { id, name, groupId } });
    console.log(`✅ ویژگی «${name}» ساخته شد`);
  }
  for (let i = 0; i < values.length; i++) {
    await prisma.attributeValue.upsert({
      where: { attributeId_value: { attributeId: id, value: values[i] } },
      update: { order: i },
      create: { attributeId: id, value: values[i], order: i },
    });
  }
  console.log(`  ↳ مقادیر «${name}»: ${values.join(", ")}`);
}

async function ensureSharedAttributeParam(siteId, attributeId, paramTemplate, sharedKey) {
  const existing = await prisma.externalSiteAttributeParam.findFirst({
    where: { siteId, attributeId, value: null },
  });
  if (existing) {
    await prisma.externalSiteAttributeParam.update({
      where: { id: existing.id },
      data: { paramTemplate, sharedKey },
    });
  } else {
    await prisma.externalSiteAttributeParam.create({
      data: { siteId, attributeId, value: null, paramTemplate, sharedKey },
    });
  }
  console.log(`  ↳ ${attributeId} -> sharedKey="${sharedKey}", paramTemplate="${paramTemplate}"`);
}

async function main() {
  // مقادیری که از پیش وجود دارن (سایز لباس، سایز کفش، سایز لباس عددی) رو دست
  // نمی‌زنیم؛ فقط دوتای جدید (سایز سنی، استاندارد) رو اضافه می‌کنیم
  await ensureAttribute("attr_size_age", "سایز سنی", "ag_size", ["2-3", "4-5", "6-7", "8-9", "10"]);
  await ensureAttribute("attr_size_standard", "استاندارد", "ag_size", ["standart"]);

  const trendyol = await prisma.externalSite.findUnique({ where: { slug: "trendyol" } });
  if (!trendyol) {
    console.log("⚠️  سایت «trendyol» پیدا نشد -- اول prisma/seedExternalSites.js رو اجرا کن.");
    return;
  }

  const SHARED_KEY = "vr=size|";
  await ensureSharedAttributeParam(trendyol.id, "attr_size_clothing", "group-{value}", SHARED_KEY);
  await ensureSharedAttributeParam(trendyol.id, "attr_size_shoes", "{value}", SHARED_KEY);
  await ensureSharedAttributeParam(trendyol.id, "cmruyznl8000ceqrofripyzt3", "{value}", SHARED_KEY); // سایز لباس عددی
  await ensureSharedAttributeParam(trendyol.id, "attr_size_age", "{value}-yas", SHARED_KEY);
  await ensureSharedAttributeParam(trendyol.id, "attr_size_standard", "{value}", SHARED_KEY);

  console.log("\nانجام شد. حالا توی /marketplaces/trendyol می‌تونی هم‌زمان از چندتا دراپ‌داون سایز مختلف");
  console.log("(سایز لباس، سایز کفش، سایز لباس عددی، سایز سنی، استاندارد) مقدار انتخاب کنی و ببینی");
  console.log("همه‌شون زیر یه vr=size|... ترکیب می‌شن.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

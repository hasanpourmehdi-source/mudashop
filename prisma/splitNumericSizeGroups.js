// اجرا: node prisma/splitNumericSizeGroups.js
//
// این اسکریپت ویژگی شلوغ «سایز عددی/متفرقه (کامل)» (که قبلاً با
// seedFullSizeFacet.js ساخته بودیم) رو حذف می‌کنه و به‌جاش ۶ تا ویژگی
// معنی‌دار و جداگانه می‌سازه -- همه‌شون بازم زیر همون sharedKey مشترک
// (vr=size|) هستن، فقط توی پنل ادمین دیگه یه دراپ‌داون ۱۲۸تایی قاطی‌پاتی
// نیست، بلکه ۶ تا گروه تمیز و قابل‌فهمه.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const GROUPS = [
  {
    id: "attr_size_numeric_single",
    name: "سایز عددی (تکی)",
    values: [
      "x", "1", "2", "3", "4", "5", "6", "22", "24", "25", "26", "27", "28",
      "29", "30", "31", "32", "33", "34", "36", "38", "40", "42", "44", "46",
      "48", "50", "52", "54", "56", "58", "75", "80", "85", "90", "95", "100",
      "105", "110",
    ],
  },
  {
    id: "attr_size_numeric_range",
    name: "سایز عددی (بازه‌ای)",
    values: [
      "35-38", "35-39", "35-40", "36-38", "36-39", "36-41", "36-42", "36-44",
      "37-44", "38-40", "39-40", "39-42", "40-44", "40-45", "42-44", "44-46",
      "46-48", "48-50", "50-52", "52-54", "54-56", "4-0", "40-42", "3-0",
      "3-2", "4-4", "36-", "36---40", "34-",
    ],
  },
  {
    id: "attr_size_age",
    name: "سایز سنی (بچگانه)",
    values: [
      "1-2-yas", "2-3-yas", "2-4-yas", "3-4-yas", "4-yas", "4-5-yas",
      "5-6-yas", "6-yas", "6-7-yas", "7-8-yas", "8-yas", "8-9-yas",
      "8-12-yas", "9-10-yas", "10-yas", "10-11-yas", "11-12-yas", "12-yas",
      "12-13-yas", "13-14-yas",
    ],
  },
  {
    id: "attr_size_bra",
    name: "سایز سینه‌بند",
    values: [
      "70b", "75b", "75c", "75d", "80b", "80c", "80d", "85b", "85c", "85d",
      "90b", "90c", "90d", "95b", "95c", "95d", "100b", "100c", "100d",
      "105b", "110b", "80dd", "85dd", "90dd",
    ],
  },
  {
    id: "attr_size_standard",
    name: "استاندارد/تک‌سایز",
    values: ["tek-ebat", "standart"],
  },
  {
    id: "attr_size_dimensions",
    name: "ابعاد (طول × عرض)",
    values: [
      "75-x-190", "75-x-195", "190-x-75", "80-x-180", "75-x-180", "180-x-70",
      "190-x-80", "70-x-180", "75-x-200", "70-x-200", "75-x-185", "80-x-190",
      "70-x-190", "75--x-195",
    ],
  },
];

const OLD_ATTRIBUTE_ID = "attr_size_numeric_full";

async function main() {
  const trendyol = await prisma.externalSite.findUnique({ where: { slug: "trendyol" } });
  if (!trendyol) {
    console.log("⚠️  سایت «trendyol» پیدا نشد.");
    return;
  }

  // حذف ویژگی قدیمی شلوغ (و نگاشتش روی سایت) اگه وجود داشته باشه
  const oldAttr = await prisma.attribute.findUnique({ where: { id: OLD_ATTRIBUTE_ID } });
  if (oldAttr) {
    await prisma.attribute.delete({ where: { id: OLD_ATTRIBUTE_ID } });
    console.log(`🗑️  ویژگی قدیمی «${oldAttr.name}» و همه‌ی مقادیر/نگاشت‌هاش حذف شد`);
  }

  const SHARED_KEY = "vr=size|";

  for (const group of GROUPS) {
    // ساخت ویژگی + مقادیرش
    const existing = await prisma.attribute.findUnique({ where: { id: group.id } });
    if (!existing) {
      await prisma.attribute.create({ data: { id: group.id, name: group.name, groupId: "ag_size" } });
      console.log(`✅ ویژگی «${group.name}» ساخته شد`);
    }
    for (let i = 0; i < group.values.length; i++) {
      await prisma.attributeValue.upsert({
        where: { attributeId_value: { attributeId: group.id, value: group.values[i] } },
        update: { order: i },
        create: { attributeId: group.id, value: group.values[i], order: i },
      });
    }
    console.log(`  ↳ ${group.values.length} مقدار ثبت شد`);

    // نگاشت روی سایت ترندیول -- همه با قالب خام {value} و همون کلید مشترک
    const existingParam = await prisma.externalSiteAttributeParam.findFirst({
      where: { siteId: trendyol.id, attributeId: group.id, value: null },
    });
    if (existingParam) {
      await prisma.externalSiteAttributeParam.update({
        where: { id: existingParam.id },
        data: { paramTemplate: "{value}", sharedKey: SHARED_KEY },
      });
    } else {
      await prisma.externalSiteAttributeParam.create({
        data: {
          siteId: trendyol.id,
          attributeId: group.id,
          value: null,
          paramTemplate: "{value}",
          sharedKey: SHARED_KEY,
        },
      });
    }
    console.log(`  ↳ نگاشت شد: sharedKey="${SHARED_KEY}", paramTemplate="{value}"`);
  }

  console.log("\nانجام شد. حالا به‌جای یه دراپ‌داون ۱۲۸تایی، ۶ تا ویژگی جدا و مرتب داری:");
  GROUPS.forEach((g) => console.log(`  - ${g.name} (${g.values.length} مقدار)`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

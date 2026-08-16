// اجرا: node prisma/seedFullSizeFacet.js
//
// این اسکریپت همه‌ی مقادیر واقعی «Beden» (سایز) رو که مستقیماً از پاسخ خام
// اندپوینت aggregations خودِ ترندیول گرفتیم (نه حدس‌زده‌شده) توی دیتابیس ثبت
// می‌کنه -- یعنی دیگه هیچ مقداری از دست نمی‌ره و هیچ‌کدوم حدسی نیست.
//
// دو دسته‌ی اصلی پیدا شد:
//   ۱) مقادیری که با "group-" شروع می‌شن (حرفی: 2XS تا 12XL + بازه‌های ترکیبی)
//      -> می‌ریزیم توی attr_size_clothing (سایز لباس)، با قالب group-{value}
//   ۲) بقیه‌ی مقادیر (عددی، بازه‌ای، سنی با پسوند yas از پیش آماده، سایز
//      سینه‌بند با حرف کاپ، تک‌ابعاد، استاندارد، ...) -- همه‌شون از قبل توسط
//      خودِ ترندیول کامل و آماده‌ی استفاده‌ان (نیازی به تبدیل بیشتر ندارن)
//      -> می‌ریزیم توی یه ویژگی جدید attr_size_numeric_full، با قالب {value} خام
//
// نکته: مقادیر facet جدای «size-dimensions» (ابعاد پرده/تشک و مثل اون) هم به
// همین ویژگی دوم اضافه شدن چون تداخلی با بقیه ندارن؛ ولی مطمئن نیستیم دقیقاً
// همون کلید مشترک "vr=size|" رو دارن یا کلید دیگه‌ای -- اگه بعداً مشخص شد کلید
// دیگه‌ای لازمه، فقط کافیه sharedKeyشون رو عوض کنیم.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// بخش ۱: مقادیر «group-*» (حرفی) -- از facet واقعی size، پیشوند group- حذف شده
const GROUP_VALUES = [
  "2xs", "xs", "s", "m", "l", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl",
  "8xl", "9xl", "10xl", "11xl", "12xl", "2xs-xs", "xs-s", "s-m", "m-l",
  "l-xl", "xl-2xl", "2xl-3xl", "3xl-4xl", "4xl-5xl", "5xl-6xl",
];

// بخش ۲: بقیه‌ی مقادیر facet size (عددی/بازه‌ای/سنی/سینه‌بند/استاندارد) -- این‌ها
// از قبل کامل و آماده‌ان (خودِ ترندیول این‌طور برگردونده، نیازی به تبدیل نیست)
const RAW_SIZE_VALUES = [
  "x", "1", "2", "3", "4", "5", "6", "22", "24", "25", "26", "27", "28", "29",
  "30", "31", "32", "33", "34", "36", "38", "40", "42", "44", "46", "48", "50",
  "52", "54", "56", "58", "75", "80", "85", "90", "95", "100", "105", "110",
  "35-38", "35-39", "35-40", "36-38", "36-39", "36-41", "36-42", "36-44",
  "37-44", "38-40", "39-40", "39-42", "40-44", "40-45", "42-44", "44-46",
  "46-48", "48-50", "50-52", "52-54", "54-56", "4-0", "40-42",
  "1-2-yas", "2-4-yas", "3-4-yas", "4-yas", "4-5-yas", "5-6-yas", "6-yas",
  "6-7-yas", "7-8-yas", "8-yas", "8-9-yas", "8-12-yas", "9-10-yas", "10-yas",
  "10-11-yas", "11-12-yas", "12-yas", "12-13-yas", "13-14-yas",
  "tek-ebat", "standart",
  "70b", "75b", "75c", "75d", "80b", "80c", "80d", "85b", "85c", "85d",
  "90b", "90c", "90d", "95b", "95c", "95d", "100b", "100c", "100d", "105b",
  "110b", "80dd", "85dd", "90dd",
  "3-0", "3-2", "4-4", "2-3-yas", "36-", "36---40", "34-",
];

// بخش ۳: facet جدای «size-dimensions» (ابعاد پرده/تشک) -- کامل و آماده هم هستن
const DIMENSION_VALUES = [
  "75-x-190", "75-x-195", "190-x-75", "80-x-180", "75-x-180", "180-x-70",
  "190-x-80", "70-x-180", "75-x-200", "70-x-200", "75-x-185", "80-x-190",
  "70-x-190", "75--x-195",
  // "tek-ebat" توی بخش ۲ هم هست، دوباره لازم نیست
];

async function ensureAttribute(id, name, groupId, values) {
  const existing = await prisma.attribute.findUnique({ where: { id } });
  if (!existing) {
    await prisma.attribute.create({ data: { id, name, groupId } });
    console.log(`✅ ویژگی «${name}» ساخته شد`);
  } else {
    console.log(`↻ ویژگی «${name}» از قبل بود، فقط مقادیرش تکمیل می‌شه`);
  }
  for (let i = 0; i < values.length; i++) {
    await prisma.attributeValue.upsert({
      where: { attributeId_value: { attributeId: id, value: values[i] } },
      update: { order: i },
      create: { attributeId: id, value: values[i], order: i },
    });
  }
  console.log(`  ↳ ${values.length} مقدار برای «${name}» ثبت/به‌روزرسانی شد`);
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
  // بخش ۱: تکمیل «سایز لباس» (attr_size_clothing) با همه‌ی ۲۷ مقدار واقعی حرفی
  await ensureAttribute("attr_size_clothing", "سایز لباس", "ag_size", GROUP_VALUES);

  // بخش ۲: یه ویژگی جدید و جامع برای همه‌ی مقادیر غیرحرفی (عددی/سنی/سینه‌بند/استاندارد/ابعاد)
  await ensureAttribute(
    "attr_size_numeric_full",
    "سایز عددی/متفرقه (کامل)",
    "ag_size",
    [...RAW_SIZE_VALUES, ...DIMENSION_VALUES]
  );

  const trendyol = await prisma.externalSite.findUnique({ where: { slug: "trendyol" } });
  if (!trendyol) {
    console.log("⚠️  سایت «trendyol» پیدا نشد -- اول prisma/seedExternalSites.js رو اجرا کن.");
    return;
  }

  const SHARED_KEY = "vr=size|";
  await ensureSharedAttributeParam(trendyol.id, "attr_size_clothing", "group-{value}", SHARED_KEY);
  await ensureSharedAttributeParam(trendyol.id, "attr_size_numeric_full", "{value}", SHARED_KEY);

  console.log("\nانجام شد. حالا «سایز لباس» و «سایز عددی/متفرقه (کامل)» توی /marketplaces/trendyol");
  console.log("هرکدوم چندین گزینه‌ی واقعی و کامل دارن -- هیچ‌کدوم از ۱۴۱ مقدار واقعی از دست نرفته.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// اجرا: node prisma/cleanupDuplicateSizeValues.js
//
// چون از قبل «سایز لباس» ۴ تا مقدار حروف‌بزرگ (S, M, L, XL) داشت، و بعداً
// seedFullSizeFacet.js کل لیست حروف‌کوچیک (s, m, l, xl, ...) رو هم اضافه کرد،
// این‌ها به‌عنوان مقادیر جدا (نه تکراری) ثبت شدن -- چون از نظر دیتابیس «S» و
// «s» دو رشته‌ی متفاوتن. این اسکریپت نسخه‌های حروف‌بزرگِ قدیمی رو که با نسخه‌ی
// حروف‌کوچیکِ جامع هم‌پوشانی دارن حذف می‌کنه.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ATTRIBUTE_ID = "attr_size_clothing";
// دقیقاً همون ۴ تای قدیمی که با نسخه‌ی حروف‌کوچیک تکراری شدن
const OLD_UPPERCASE_VALUES = ["S", "M", "L", "XL"];

async function main() {
  for (const value of OLD_UPPERCASE_VALUES) {
    const existing = await prisma.attributeValue.findUnique({
      where: { attributeId_value: { attributeId: ATTRIBUTE_ID, value } },
    });
    if (existing) {
      await prisma.attributeValue.delete({ where: { id: existing.id } });
      console.log(`🗑️  مقدار تکراری «${value}» حذف شد`);
    }
  }

  // ترتیب نمایش نهایی رو هم مرتب می‌کنیم (طبق ترتیب واقعی facet ترندیول)
  const ORDER = [
    "2xs", "xs", "s", "m", "l", "xl", "2xl", "3xl", "4xl", "5xl", "6xl",
    "7xl", "8xl", "9xl", "10xl", "11xl", "12xl", "2xs-xs", "xs-s", "s-m",
    "m-l", "l-xl", "xl-2xl", "2xl-3xl", "3xl-4xl", "4xl-5xl", "5xl-6xl",
  ];
  for (let i = 0; i < ORDER.length; i++) {
    await prisma.attributeValue.updateMany({
      where: { attributeId: ATTRIBUTE_ID, value: ORDER[i] },
      data: { order: i },
    });
  }

  const remaining = await prisma.attributeValue.findMany({
    where: { attributeId: ATTRIBUTE_ID },
    orderBy: { order: "asc" },
  });
  console.log(`\nانجام شد. «سایز لباس» الان ${remaining.length} مقدار داره (بدون تکراری):`);
  console.log(remaining.map((v) => v.value).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

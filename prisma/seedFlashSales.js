// اجرا: node prisma/seedFlashSales.js
//
// چند تا حراج فلش فعال (۳ روزه) روی محصولات نمونه‌ی مزون می‌سازه یا تازه می‌کنه، تا بخش
// «حراج فلش» صفحه‌ی اصلی چیزی برای نمایش داشته باشه. اگه قبلاً حراجی برای یه محصول
// وجود داشته باشه (حتی تمام‌شده)، تاریخ و موجودیش رو رفرش می‌کنه؛ در غیر این صورت
// یه ردیف جدید می‌سازه. اگه محصولی با اون slug پیدا نشه، فقط رد می‌شه (خطا نمی‌ده).

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// slug محصول -> { درصد تخفیف حراج، موجودی مخصوص حراج }
const TARGETS = [
  { slug: "womens-sporty-manteau", discountPercent: 35, stock: 10 },
  { slug: "sporty-smartwatch", discountPercent: 20, stock: 15 },
  { slug: "mens-leather-formal-shoes", discountPercent: 30, stock: 8 },
  { slug: "womens-leather-handbag", discountPercent: 25, stock: 12 },
  { slug: "womens-sneakers", discountPercent: 15, stock: 20 },
];

async function main() {
  const now = new Date();
  const endsAt = new Date(now.getTime() + THREE_DAYS_MS);

  for (const { slug, discountPercent, stock } of TARGETS) {
    const product = await prisma.product.findUnique({ where: { slug } });
    if (!product) {
      console.log(`⚠️  محصولی با slug="${slug}" پیدا نشد -- رد شد.`);
      continue;
    }

    const existing = await prisma.flashSale.findFirst({ where: { productId: product.id } });

    if (existing) {
      await prisma.flashSale.update({
        where: { id: existing.id },
        data: { discountPercent, stock, startsAt: now, endsAt, isActive: true },
      });
      console.log(`🔄 حراج فلش «${product.title}» تازه شد (${discountPercent}٪، تا ${endsAt.toLocaleString("fa-IR")})`);
    } else {
      await prisma.flashSale.create({
        data: { productId: product.id, discountPercent, stock, startsAt: now, endsAt, isActive: true },
      });
      console.log(`✅ حراج فلش «${product.title}» ساخته شد (${discountPercent}٪، تا ${endsAt.toLocaleString("fa-IR")})`);
    }
  }

  console.log("انجام شد.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

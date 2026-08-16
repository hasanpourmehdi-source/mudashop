// اجرا: node scripts/cleanup-zero-stock-variants.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const zeroStockVariants = await prisma.productVariant.findMany({
    where: { stock: { lte: 0 } },
    select: { id: true, sku: true, productId: true },
  });

  console.log(`${zeroStockVariants.length} ترکیب با موجودی صفر پیدا شد.`);

  if (zeroStockVariants.length === 0) {
    console.log("چیزی برای پاک‌سازی نیست.");
    return;
  }

  let deleted = 0;
  let skipped = 0;

  for (const variant of zeroStockVariants) {
    try {
      await prisma.productVariant.delete({ where: { id: variant.id } });
      deleted++;
    } catch {
      // احتمالاً توی یه سفارش قبلی استفاده شده -- این‌ها رو نگه می‌داریم تا تاریخچه سفارش خراب نشه
      skipped++;
    }
  }

  console.log(`✅ ${deleted} ترکیب حذف شد.`);
  if (skipped > 0) {
    console.log(
      `⚠️  ${skipped} ترکیب چون توی سفارش قبلی استفاده شده حذف نشد (موجودی صفرشون باقی می‌مونه، طبیعیه).`
    );
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

// یه‌بار مصرف: همه‌ی نظرات رو پاک می‌کنه تا از اول تست کنی
// اجرا: node prisma/clear-reviews.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const { count } = await prisma.review.deleteMany({});
  console.log(`${count} نظر حذف شد.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

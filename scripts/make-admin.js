// اجرا: node scripts/make-admin.js <email>
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const [, , email] = process.argv;

  if (!email) {
    console.error("استفاده: node scripts/make-admin.js <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`کاربری با ایمیل «${email}» پیدا نشد.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });

  console.log(`✅ کاربر «${email}» به ادمین تبدیل شد. برای اعمال شدن، یک‌بار logout/login کند.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

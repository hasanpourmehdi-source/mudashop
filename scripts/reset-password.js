// اجرا: node scripts/reset-password.js <email> <new-password>
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const [, , email, newPassword] = process.argv;

  if (!email || !newPassword) {
    console.error("استفاده: node scripts/reset-password.js <email> <new-password>");
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.error("رمز عبور باید حداقل ۶ کاراکتر باشد.");
    process.exit(1);
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`کاربری با ایمیل «${email}» پیدا نشد.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { email },
    data: { password: hashed },
  });

  console.log(`✅ رمز عبور کاربر «${email}» با موفقیت تغییر کرد.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

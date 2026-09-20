// حذفِ کاملِ همه‌ی دیتای تستیِ QA (qa-seed.cjs + qa-seed-2.cjs) -- محصولات،
// کاربر، سفارش‌ها، تراکنش‌های کیف‌پول، اعلان‌ها، درخواستِ مرجوعی. به همون
// ترتیبی که وابستگی‌های دیتابیس اجازه می‌دن (تراکنش‌ها و سفارش‌ها قبل از
// محصولات و کاربر)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "qa-test-customer@mudashop-test.internal" },
  });

  if (user) {
    const orders = await prisma.order.findMany({ where: { userId: user.id }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    if (wallet) {
      const txDelete = await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
      console.log("تراکنش‌های کیف‌پول حذف شد:", txDelete.count);
    }

    const notifDelete = await prisma.notification.deleteMany({ where: { userId: user.id } });
    console.log("اعلان‌ها حذف شد:", notifDelete.count);

    // حذفِ سفارش‌ها -- OrderItem/OrderStatusHistory/ReturnRequest همه با
    // onDelete:Cascade به Order وصل‌ان، پس خودکار پاک می‌شن
    const orderDelete = await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    console.log("سفارش‌ها حذف شد:", orderDelete.count);

    // حذفِ کاربر -- Wallet/Address/... با onDelete:Cascade به User وصل‌ان
    await prisma.user.delete({ where: { id: user.id } });
    console.log("کاربرِ تستی حذف شد:", user.email);
  } else {
    console.log("کاربرِ تستی پیدا نشد -- احتمالاً قبلاً حذف شده");
  }

  const productDelete = await prisma.product.deleteMany({
    where: { slug: { startsWith: "qa-test-product-" } },
  });
  console.log("محصولاتِ تستی حذف شد:", productDelete.count);

  console.log("\n=== پاک‌سازیِ QA کامل شد ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

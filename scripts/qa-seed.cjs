// اسکریپتِ یک‌بارمصرفِ QA -- محصول/کاربر/سفارشِ تستی می‌سازه تا فیچرهایی که
// بدونِ دیتای واقعی (هم‌خریدی، وفاداری، مرجوعیِ خودخدمت) هیچی نشون نمی‌دن رو
// بشه واقعاً دید. همه‌چیز با پیشوندِ [QA-TEST] یا ایمیلِ qa-test-* مشخصه تا با
// qa-cleanup.cjs کاملاً پاک بشه -- هیچ‌کدوم قرار نیست دائمی بمونه.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.findFirst({ where: { slug: "clothing" } });
  const brand = await prisma.brand.findFirst();
  if (!category || !brand) throw new Error("دسته‌بندی یا برندِ پایه پیدا نشد");

  const img = (label) =>
    JSON.stringify([`https://placehold.co/700x900/e8ddd0/5c4a3a/png?text=${encodeURIComponent(label)}`]);

  const products = await Promise.all(
    ["A", "B", "C"].map((suffix, i) =>
      prisma.product.create({
        data: {
          title: `[QA-TEST] پیراهن تستی ${suffix}`,
          slug: `qa-test-product-${suffix.toLowerCase()}`,
          description: "محصولِ تستیِ موقت -- فقط برای بررسیِ فیچرهای هم‌خریدی/وفاداری، بعداً حذف می‌شه.",
          brandId: brand.id,
          categoryId: category.id,
          basePrice: 1_500_000 + i * 100_000,
          images: img(`QA Product ${suffix}`),
          isActive: true,
        },
      })
    )
  );
  console.log(
    "محصولات ساخته شد:",
    products.map((p) => p.slug)
  );

  const hashedPassword = await bcrypt.hash("QaTest#12345", 10);
  const user = await prisma.user.create({
    data: {
      name: "کاربر تستِ QA",
      email: "qa-test-customer@mudashop-test.internal",
      password: hashedPassword,
      emailVerified: new Date(),
      role: "CUSTOMER",
    },
  });
  await prisma.wallet.create({ data: { userId: user.id, balance: 0 } });
  const address = await prisma.address.create({
    data: {
      userId: user.id,
      title: "خانه (تستی)",
      fullName: "کاربر تستِ QA",
      phone: "09120000000",
      province: "تهران",
      city: "تهران",
      postalCode: "1234567890",
      detail: "آدرسِ تستی -- فقط برای QA",
      isDefault: true,
    },
  });
  console.log("کاربرِ تستی ساخته شد:", user.email);

  const addressSnapshot = JSON.stringify({
    title: address.title,
    fullName: address.fullName,
    phone: address.phone,
    province: address.province,
    city: address.city,
    postalCode: address.postalCode,
    detail: address.detail,
  });

  const now = Date.now();
  const day = 86_400_000;

  async function createDeliveredOrder({ items, createdAt, deliveredAt }) {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        addressId: address.id,
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: "CARD_TRANSFER",
        paidAt: createdAt,
        deliveredAt,
        subtotal,
        total: subtotal,
        shippingCost: 45000,
        addressSnapshot,
        createdAt,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            source: "MAZON",
            title: i.title,
            image: i.image,
            price: i.price,
            quantity: i.quantity,
          })),
        },
        statusHistory: {
          create: [
            { status: "PENDING", createdAt },
            { status: "DELIVERED", note: "[QA-TEST] تحویلِ شبیه‌سازی‌شده", createdAt: deliveredAt },
          ],
        },
      },
    });
    return order;
  }

  const orderA = await createDeliveredOrder({
    createdAt: new Date(now - 6 * day),
    deliveredAt: new Date(now - 3 * day),
    items: [
      { productId: products[0].id, title: products[0].title, image: JSON.parse(products[0].images)[0], price: products[0].basePrice, quantity: 1 },
      { productId: products[1].id, title: products[1].title, image: JSON.parse(products[1].images)[0], price: products[1].basePrice, quantity: 1 },
    ],
  });
  const orderB = await createDeliveredOrder({
    createdAt: new Date(now - 1 * day),
    deliveredAt: new Date(now),
    items: [
      { productId: products[1].id, title: products[1].title, image: JSON.parse(products[1].images)[0], price: products[1].basePrice, quantity: 1 },
      { productId: products[2].id, title: products[2].title, image: JSON.parse(products[2].images)[0], price: products[2].basePrice, quantity: 1 },
    ],
  });
  console.log("سفارش‌های تحویل‌شده ساخته شد:", orderA.id, orderB.id);

  // اعمالِ دستیِ کسراژ/امتیازِ وفاداری -- دقیقاً همون فرمولِ
  // src/app/api/admin/orders/[id]/packages/arrive/route.ts (دونستنِ مقادیرِ
  // پیش‌فرض از siteSettings.ts؛ چون هیچ سطرِ override ای توی DB نبود، تنظیماتِ
  // فعلاً پیش‌فرضن: پایه ۲٪، هر ۱۰٬۰۰۰ تومان=۱امتیاز، نقره‌ای از ۵۰۰امتیاز(+۱٪), طلایی از۲۰۰۰(+۲٪)
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const tiers = [
    { key: "GOLD", min: 2000, bonus: 2 },
    { key: "SILVER", min: 500, bonus: 1 },
    { key: "BRONZE", min: 0, bonus: 0 },
  ];
  const tierFor = (points) => tiers.find((t) => points >= t.min);

  let points = 0;
  let walletBalance = wallet.balance;
  for (const order of [orderA, orderB]) {
    const tierBefore = tierFor(points);
    const cashback = Math.round((order.total * (2 + tierBefore.bonus)) / 100);
    const pointsEarned = Math.floor(order.total / 10_000);
    walletBalance += cashback;
    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "LOYALTY",
        amount: cashback,
        description: `[QA-TEST] کسراژ وفاداری سفارش #${order.id.slice(-6)}`,
        orderId: order.id,
      },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        message: `${cashback.toLocaleString("fa-IR")} تومان کسراژ وفاداری سفارش #${order.id.slice(-6)} به کیف پولت اضافه شد 🎁`,
        link: "/loyalty",
      },
    });
    points += pointsEarned;
    const tierAfter = tierFor(points);
    if (tierAfter.key !== tierBefore.key) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          message: `🎉 به سطح ${tierAfter.key === "SILVER" ? "نقره‌ای" : tierAfter.key === "GOLD" ? "طلایی" : "برنزی"} باشگاه مشتریان ارتقا یافتی!`,
          link: "/loyalty",
        },
      });
    }
  }
  await prisma.wallet.update({ where: { userId: user.id }, data: { balance: walletBalance } });
  await prisma.user.update({ where: { id: user.id }, data: { loyaltyPoints: points } });
  console.log("وفاداری اعمال شد -- امتیاز نهایی:", points, "موجودیِ کیف‌پول:", walletBalance);

  console.log("\n=== خلاصه ===");
  console.log("ایمیلِ کاربرِ تستی:", user.email);
  console.log("رمزِ کاربرِ تستی: QaTest#12345");
  console.log("شناسه‌ی کاربر:", user.id);
  console.log(
    "شناسه‌ی محصولات:",
    products.map((p) => p.id)
  );
  console.log("شناسه‌ی سفارش‌ها:", orderA.id, orderB.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

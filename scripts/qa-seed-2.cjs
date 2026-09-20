// ادامه‌ی qa-seed.cjs -- سناریوهای بیشتر: سفارشِ ترکیبیِ مزون+ترندیول، سفارشِ
// لغوشده (باید از هم‌خریدی/وفاداری کنار گذاشته بشه)، سفارشِ خارج از مهلتِ
// مرجوعی، محصولِ غیرقابل‌مرجوع، سفارشِ درانتظار/ارسال‌شده (تنوعِ چرخه‌ی عمر
// توی لیستِ ادمین)، و یه سفارشِ بزرگ برای رسیدن به سطحِ طلایی
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const USER_ID = "cmu438fng0006eq94lrsxx8ac";
const ADDRESS_ID = "cmu438fz9000aeq942e202fc3";
const WALLET_ID = "cmu438fth0008eq946bzwellv";
const PRODUCT_A = { id: "cmu438fgp0005eq94z7jdiljy", price: 1_500_000, title: "[QA-TEST] پیراهن تستی A" };
const PRODUCT_B = { id: "cmu438fg60003eq94ac603nyj", price: 1_600_000, title: "[QA-TEST] پیراهن تستی B" };
const PRODUCT_C = { id: "cmu438eyl0001eq94vtb5wumy", price: 1_700_000, title: "[QA-TEST] پیراهن تستی C" };
const TRENDYOL_EXTERNAL_ID = "971347342"; // عطرِ همون محصولی که قبلاً توی همین جلسه تست شده -- کشِ URL داره

async function main() {
  const category = await prisma.category.findFirst({ where: { slug: "clothing" } });
  const brand = await prisma.brand.findFirst();

  const productD = await prisma.product.create({
    data: {
      title: "[QA-TEST] پیراهن تستی D (غیرقابل‌مرجوع)",
      slug: "qa-test-product-d",
      description: "محصولِ تستیِ موقتِ غیرقابل‌مرجوع -- فقط برای QA.",
      brandId: brand.id,
      categoryId: category.id,
      basePrice: 1_500_000,
      images: JSON.stringify(["https://placehold.co/700x900/e8ddd0/5c4a3a/png?text=QA+Product+D"]),
      isActive: true,
      isReturnable: false,
    },
  });
  console.log("محصولِ D (غیرقابل‌مرجوع) ساخته شد:", productD.slug);

  const addressSnapshot = JSON.stringify({
    title: "خانه (تستی)",
    fullName: "کاربر تستِ QA",
    phone: "09120000000",
    province: "تهران",
    city: "تهران",
    postalCode: "1234567890",
    detail: "آدرسِ تستی -- فقط برای QA",
  });

  const now = Date.now();
  const day = 86_400_000;

  // سفارشِ ترکیبی (مزون + ترندیول) -- تحویل‌شده همین الان، داخلِ مهلتِ مرجوعی
  const orderMixed = await prisma.order.create({
    data: {
      userId: USER_ID,
      addressId: ADDRESS_ID,
      status: "DELIVERED",
      paymentStatus: "PAID",
      paymentMethod: "CARD_TRANSFER",
      paidAt: new Date(now - 2 * day),
      deliveredAt: new Date(now),
      subtotal: PRODUCT_A.price + 1_500_000,
      total: PRODUCT_A.price + 1_500_000,
      shippingCost: 0,
      addressSnapshot,
      createdAt: new Date(now - 2 * day),
      items: {
        create: [
          { productId: PRODUCT_A.id, source: "MAZON", title: PRODUCT_A.title, price: PRODUCT_A.price, quantity: 1 },
          {
            externalId: TRENDYOL_EXTERNAL_ID,
            source: "TRENDYOL",
            title: "عطر ۵۰ میل ادوپرفیوم زنانه",
            price: 1_500_000,
            quantity: 1,
          },
        ],
      },
      statusHistory: { create: [{ status: "PENDING", createdAt: new Date(now - 2 * day) }, { status: "DELIVERED", createdAt: new Date(now) }] },
    },
  });
  console.log("سفارشِ ترکیبیِ مزون+ترندیول ساخته شد:", orderMixed.id);

  // سفارشِ لغوشده -- نباید توی هم‌خریدی/وفاداری حساب بشه
  const orderCancelled = await prisma.order.create({
    data: {
      userId: USER_ID,
      addressId: ADDRESS_ID,
      status: "CANCELLED",
      paymentStatus: "PENDING",
      paymentMethod: "CARD_TRANSFER",
      subtotal: PRODUCT_C.price,
      total: PRODUCT_C.price,
      addressSnapshot,
      createdAt: new Date(now - 4 * day),
      items: { create: [{ productId: PRODUCT_C.id, source: "MAZON", title: PRODUCT_C.title, price: PRODUCT_C.price, quantity: 1 }] },
      statusHistory: { create: [{ status: "PENDING", createdAt: new Date(now - 4 * day) }, { status: "CANCELLED", note: "[QA-TEST] لغوِ شبیه‌سازی‌شده", createdAt: new Date(now - 4 * day) }] },
    },
  });
  console.log("سفارشِ لغوشده ساخته شد:", orderCancelled.id);

  // سفارشِ خیلی قدیمی (۱۰ روز پیش تحویل‌شده -- خارج از مهلتِ ۷روزه) با محصولِ غیرقابل‌مرجوع
  const orderExpired = await prisma.order.create({
    data: {
      userId: USER_ID,
      addressId: ADDRESS_ID,
      status: "DELIVERED",
      paymentStatus: "PAID",
      paymentMethod: "CARD_TRANSFER",
      paidAt: new Date(now - 12 * day),
      deliveredAt: new Date(now - 10 * day),
      subtotal: productD.basePrice,
      total: productD.basePrice,
      shippingCost: 45000,
      addressSnapshot,
      createdAt: new Date(now - 12 * day),
      items: { create: [{ productId: productD.id, source: "MAZON", title: productD.title, price: productD.basePrice, quantity: 1 }] },
      statusHistory: { create: [{ status: "PENDING", createdAt: new Date(now - 12 * day) }, { status: "DELIVERED", createdAt: new Date(now - 10 * day) }] },
    },
  });
  console.log("سفارشِ خارج از مهلتِ مرجوعی (محصولِ غیرقابل‌مرجوع) ساخته شد:", orderExpired.id);

  // سفارشِ بزرگ -- برای رسیدن به سطحِ طلایی
  const orderBig = await prisma.order.create({
    data: {
      userId: USER_ID,
      addressId: ADDRESS_ID,
      status: "DELIVERED",
      paymentStatus: "PAID",
      paymentMethod: "CARD_TRANSFER",
      paidAt: new Date(now - 1 * day),
      deliveredAt: new Date(now),
      subtotal: PRODUCT_A.price * 10,
      total: PRODUCT_A.price * 10,
      shippingCost: 0,
      addressSnapshot,
      createdAt: new Date(now - 1 * day),
      items: { create: [{ productId: PRODUCT_A.id, source: "MAZON", title: PRODUCT_A.title, price: PRODUCT_A.price, quantity: 10 }] },
      statusHistory: { create: [{ status: "PENDING", createdAt: new Date(now - 1 * day) }, { status: "DELIVERED", createdAt: new Date(now) }] },
    },
  });
  console.log("سفارشِ بزرگ (برای سطحِ طلایی) ساخته شد:", orderBig.id);

  // سفارشِ در انتظار (هنوز پرداخت/بررسی نشده) -- فقط برای تنوعِ لیستِ ادمین
  const orderPending = await prisma.order.create({
    data: {
      userId: USER_ID,
      addressId: ADDRESS_ID,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "CARD_TRANSFER",
      subtotal: PRODUCT_B.price,
      total: PRODUCT_B.price,
      addressSnapshot,
      createdAt: new Date(now - 1 * 3600_000),
      items: { create: [{ productId: PRODUCT_B.id, source: "MAZON", title: PRODUCT_B.title, price: PRODUCT_B.price, quantity: 1 }] },
      statusHistory: { create: [{ status: "PENDING", createdAt: new Date(now - 1 * 3600_000) }] },
    },
  });
  console.log("سفارشِ در انتظار ساخته شد:", orderPending.id);

  // سفارشِ ارسال‌شده (هنوز تحویل داده نشده) -- تنوعِ چرخه‌ی عمر
  const orderShipped = await prisma.order.create({
    data: {
      userId: USER_ID,
      addressId: ADDRESS_ID,
      status: "SHIPPED",
      paymentStatus: "PAID",
      paymentMethod: "CARD_TRANSFER",
      paidAt: new Date(now - 2 * day),
      shippingMethod: "پست پیشتاز",
      trackingCode: "QA-TEST-TRACK-0001",
      subtotal: PRODUCT_B.price,
      total: PRODUCT_B.price,
      shippingCost: 45000,
      addressSnapshot,
      createdAt: new Date(now - 2 * day),
      items: { create: [{ productId: PRODUCT_B.id, source: "MAZON", title: PRODUCT_B.title, price: PRODUCT_B.price, quantity: 1 }] },
      statusHistory: { create: [{ status: "PENDING", createdAt: new Date(now - 2 * day) }, { status: "SHIPPED", createdAt: new Date(now - 1 * day) }] },
    },
  });
  console.log("سفارشِ ارسال‌شده ساخته شد:", orderShipped.id);

  // اعمالِ وفاداری فقط برایِ سفارش‌هایی که واقعاً تحویل داده شدن (mixed, expired, big)
  const wallet = await prisma.wallet.findUnique({ where: { id: WALLET_ID } });
  const user = await prisma.user.findUnique({ where: { id: USER_ID } });
  const tiers = [
    { key: "GOLD", min: 2000, bonus: 2 },
    { key: "SILVER", min: 500, bonus: 1 },
    { key: "BRONZE", min: 0, bonus: 0 },
  ];
  const tierFor = (points) => tiers.find((t) => points >= t.min);

  let points = user.loyaltyPoints;
  let walletBalance = wallet.balance;
  for (const order of [orderMixed, orderExpired, orderBig]) {
    const tierBefore = tierFor(points);
    const cashback = Math.round((order.total * (2 + tierBefore.bonus)) / 100);
    const pointsEarned = Math.floor(order.total / 10_000);
    walletBalance += cashback;
    await prisma.walletTransaction.create({
      data: {
        walletId: WALLET_ID,
        type: "LOYALTY",
        amount: cashback,
        description: `[QA-TEST] کسراژ وفاداری سفارش #${order.id.slice(-6)}`,
        orderId: order.id,
      },
    });
    await prisma.notification.create({
      data: {
        userId: USER_ID,
        message: `${cashback.toLocaleString("fa-IR")} تومان کسراژ وفاداری سفارش #${order.id.slice(-6)} به کیف پولت اضافه شد 🎁`,
        link: "/loyalty",
      },
    });
    points += pointsEarned;
    const tierAfter = tierFor(points);
    if (tierAfter.key !== tierBefore.key) {
      const label = tierAfter.key === "GOLD" ? "طلایی" : tierAfter.key === "SILVER" ? "نقره‌ای" : "برنزی";
      await prisma.notification.create({
        data: { userId: USER_ID, message: `🎉 به سطح ${label} باشگاه مشتریان ارتقا یافتی!`, link: "/loyalty" },
      });
    }
  }
  await prisma.wallet.update({ where: { id: WALLET_ID }, data: { balance: walletBalance } });
  await prisma.user.update({ where: { id: USER_ID }, data: { loyaltyPoints: points } });
  console.log("وفاداری به‌روز شد -- امتیازِ نهایی:", points, "موجودیِ کیف‌پول:", walletBalance);

  console.log("\n=== خلاصه‌ی سناریوهای اضافه ===");
  console.log({
    productD: productD.id,
    orderMixed: orderMixed.id,
    orderCancelled: orderCancelled.id,
    orderExpired: orderExpired.id,
    orderBig: orderBig.id,
    orderPending: orderPending.id,
    orderShipped: orderShipped.id,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import { prisma } from "@/lib/prisma";
import { aggregateMonthly, computeProfitMetrics, computeConversionRates, type MonthlyPoint } from "@/lib/adminReportsCalc";

// همه‌ی گزارش‌های استاندارد پنل ادمین -- همه از یه fetch سنگین ولی یک‌باره
// محاسبه می‌شن (نه چندتا کوئری جدا برای هر گزارش)، چون حجم داده‌ی این سایت
// (فروشگاه کوچیک/متوسط) هنوز اجازه‌ی این ساده‌سازی رو می‌ده
const DAYS_BACK = 30;
const MONTHS_BACK = 12;

type DailyPoint = { date: string; value: number; count: number };

export type AdminReports = {
  totalRevenue: number;
  totalOrders: number;
  paidOrders: number;
  avgOrderValue: number;
  cancellationRate: number; // ۰ تا ۱
  returnRate: number; // ۰ تا ۱ -- از بین سفارش‌های تحویل‌داده‌شده
  walletUsageTotal: number;
  ordersByStatus: { status: string; label: string; count: number }[];
  salesOverTime: DailyPoint[]; // آخرین ۳۰ روز
  newCustomersOverTime: DailyPoint[]; // آخرین ۳۰ روز
  topProducts: { title: string; source: string; quantity: number; revenue: number }[];
  revenueByCategory: { name: string; revenue: number }[];
  revenueByBrand: { name: string; revenue: number }[];
  couponUsage: { code: string; uses: number; totalDiscount: number }[];
  mazonOnlyOrders: number;
  externalOrders: number;
  totalUnitsSold: number;
  distinctCustomers: number;
  // --- نمودار فروش ماهانه ---
  monthlySales: MonthlyPoint[]; // ۱۲ ماهِ آخر
  // --- گزارش سود ---
  profit: ReturnType<typeof computeProfitMetrics>;
  // --- نرخ تبدیل ---
  conversion: ReturnType<typeof computeConversionRates>;
  productViews30d: number;
  totalUsers: number;
  // سبدهایی که هنوز چیزی توشون هست و به سفارش تبدیل نشدن (این لحظه، نه یه
  // بازه‌ی زمانی -- چون CartSnapshot با ثبت سفارش پاک می‌شه، نمی‌شه نرخِ
  // تاریخی دقیق حساب کرد، ولی همین «چند نفر الان معلق‌اند» هم مفیده)
  pendingAbandonedCarts: number;
  // نسبتِ مشتریانی که بیش از یک سفارشِ پرداخت‌شده دارن (وفاداری/بازگشت مشتری)
  repeatCustomerRate: number;
  // زبانِ مرورگرِ بازدیدکننده‌ها (۳۰ روز اخیر، از VisitorLocale) -- برای تصمیم
  // «آیا ارزش دارد محتوای واقعی سایت هم به زبان دیگری ترجمه شود؟»
  visitorLanguages: { lang: string; count: number }[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پردازش",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildLast30DaysSkeleton(): Map<string, { value: number; count: number }> {
  const map = new Map<string, { value: number; count: number }>();
  const now = new Date();
  for (let i = DAYS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    map.set(dayKey(d), { value: 0, count: 0 });
  }
  return map;
}

export async function fetchAdminReports(): Promise<AdminReports> {
  const thirtyDaysAgo = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000);

  const [orders, usersLast30, productViews30d, totalUsers, paidOrderUserIds, pendingAbandonedCarts, visitorLocales] = await Promise.all([
    prisma.order.findMany({
      select: {
        id: true,
        userId: true,
        status: true,
        paymentStatus: true,
        total: true,
        discountTotal: true,
        shippingCost: true,
        cargoCost: true,
        walletUsed: true,
        couponCode: true,
        createdAt: true,
        paidAt: true,
        returnRequest: { select: { id: true } },
        items: {
          select: {
            title: true,
            price: true,
            quantity: true,
            source: true,
            purchasePriceActual: true,
            product: {
              select: {
                category: { select: { name: true } },
                brand: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.productView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count(),
    prisma.order.findMany({
      where: { paymentStatus: "PAID", status: { not: "CANCELLED" } },
      select: { userId: true },
    }),
    prisma.cartSnapshot.count(),
    prisma.visitorLocale.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { browserLang: true },
    }),
  ]);

  // فقط کدِ اصلیِ زبان مهمه (مثلاً از "tr-TR" فقط "tr")، نه لهجه/کشور
  const visitorLangCounts = new Map<string, number>();
  for (const v of visitorLocales) {
    const primary = v.browserLang.split(/[-_]/)[0].toLowerCase();
    visitorLangCounts.set(primary, (visitorLangCounts.get(primary) ?? 0) + 1);
  }
  const visitorLanguages = Array.from(visitorLangCounts.entries())
    .map(([lang, count]) => ({ lang, count }))
    .sort((a, b) => b.count - a.count);

  const paidOrders = orders.filter((o) => o.paymentStatus === "PAID" && o.status !== "CANCELLED");
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const cancelledCount = orders.filter((o) => o.status === "CANCELLED").length;
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED" || o.status === "RETURNED").length;
  const returnedCount = orders.filter((o) => o.returnRequest).length;

  const statusCounts = new Map<string, number>();
  for (const o of orders) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);

  const salesSkeleton = buildLast30DaysSkeleton();
  for (const o of paidOrders) {
    if (o.createdAt < thirtyDaysAgo) continue;
    const key = dayKey(o.createdAt);
    const entry = salesSkeleton.get(key);
    if (entry) {
      entry.value += o.total;
      entry.count += 1;
    }
  }

  const customersSkeleton = buildLast30DaysSkeleton();
  for (const u of usersLast30) {
    const key = dayKey(u.createdAt);
    const entry = customersSkeleton.get(key);
    if (entry) entry.count += 1;
  }

  const productAgg = new Map<string, { title: string; source: string; quantity: number; revenue: number }>();
  const categoryAgg = new Map<string, number>();
  const brandAgg = new Map<string, number>();
  let totalUnitsSold = 0;

  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    for (const item of o.items) {
      totalUnitsSold += item.quantity;
      const key = `${item.source}::${item.title}`;
      const existing = productAgg.get(key) ?? { title: item.title, source: item.source, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.price * item.quantity;
      productAgg.set(key, existing);

      if (item.product?.category?.name) {
        categoryAgg.set(
          item.product.category.name,
          (categoryAgg.get(item.product.category.name) ?? 0) + item.price * item.quantity
        );
      }
      if (item.product?.brand?.name) {
        brandAgg.set(item.product.brand.name, (brandAgg.get(item.product.brand.name) ?? 0) + item.price * item.quantity);
      }
    }
  }

  const couponAgg = new Map<string, { uses: number; totalDiscount: number }>();
  for (const o of orders) {
    if (!o.couponCode) continue;
    const existing = couponAgg.get(o.couponCode) ?? { uses: 0, totalDiscount: 0 };
    existing.uses += 1;
    existing.totalDiscount += o.discountTotal;
    couponAgg.set(o.couponCode, existing);
  }

  const mazonOnlyOrders = orders.filter((o) => o.items.every((i) => i.source !== "TRENDYOL")).length;
  const externalOrders = orders.length - mazonOnlyOrders;
  const walletUsageTotal = orders.reduce((sum, o) => sum + o.walletUsed, 0);
  const distinctCustomers = new Set(orders.map((o) => o.userId)).size;

  const paidOrderCountByUser = new Map<string, number>();
  for (const o of paidOrders) {
    paidOrderCountByUser.set(o.userId, (paidOrderCountByUser.get(o.userId) ?? 0) + 1);
  }
  const repeatCustomers = Array.from(paidOrderCountByUser.values()).filter((c) => c > 1).length;
  const repeatCustomerRate =
    paidOrderCountByUser.size > 0 ? repeatCustomers / paidOrderCountByUser.size : 0;

  // --- نمودار فروش ماهانه: ۱۲ ماهِ آخر (سفارش‌های پرداخت‌شده) ---
  const monthlySales = aggregateMonthly(
    paidOrders.map((o) => ({ createdAt: o.createdAt, value: o.total })),
    MONTHS_BACK
  );

  // --- گزارش سود: سفارش‌های پرداخت‌شده‌ی غیرلغو ---
  const profit = computeProfitMetrics(paidOrders);

  // --- نرخ تبدیل ---
  const usersWithPaidOrder = new Set(paidOrderUserIds.map((o) => o.userId)).size;
  const conversion = computeConversionRates(
    paidOrders.filter((o) => o.createdAt >= thirtyDaysAgo).length,
    productViews30d,
    usersWithPaidOrder,
    totalUsers
  );

  return {
    totalRevenue,
    totalOrders: orders.length,
    paidOrders: paidOrders.length,
    avgOrderValue: paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0,
    cancellationRate: orders.length > 0 ? cancelledCount / orders.length : 0,
    returnRate: deliveredCount > 0 ? returnedCount / deliveredCount : 0,
    walletUsageTotal,
    ordersByStatus: Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, label: STATUS_LABELS[status] ?? status, count }))
      .sort((a, b) => b.count - a.count),
    salesOverTime: Array.from(salesSkeleton.entries()).map(([date, v]) => ({ date, value: v.value, count: v.count })),
    newCustomersOverTime: Array.from(customersSkeleton.entries()).map(([date, v]) => ({
      date,
      value: v.count,
      count: v.count,
    })),
    topProducts: Array.from(productAgg.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10),
    revenueByCategory: Array.from(categoryAgg.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
    revenueByBrand: Array.from(brandAgg.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
    couponUsage: Array.from(couponAgg.entries())
      .map(([code, v]) => ({ code, uses: v.uses, totalDiscount: v.totalDiscount }))
      .sort((a, b) => b.uses - a.uses),
    mazonOnlyOrders,
    externalOrders,
    totalUnitsSold,
    distinctCustomers,
    monthlySales,
    profit,
    conversion,
    productViews30d,
    totalUsers,
    pendingAbandonedCarts,
    visitorLanguages,
    repeatCustomerRate,
  };
}

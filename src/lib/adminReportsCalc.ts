// محاسبات خالص گزارش‌های فروش/سود/نرخ تبدیل -- جدا از دیتابیس تا تست‌پذیر باشد

// ---------- نمودار فروش ماهانه ----------

export type MonthlyPoint = { label: string; value: number; count: number };

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// اسکلت n ماهِ آخر (شامل ماه جاری) با مقادیر صفر -- تا روزهای بدون فروش هم نمایش داده شوند
export function buildLastNMonthsSkeleton(
  n: number,
  now: Date = new Date()
): Map<string, { value: number; count: number; label: string }> {
  const map = new Map<string, { value: number; count: number; label: string }>();
  const anchor = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    map.set(monthKey(m), { value: 0, count: 0, label: `${m.getMonth() + 1}/${m.getFullYear()}` });
  }
  return map;
}

// تجمیع نقاط (مثلاً سفارش‌های پرداخت‌شده) به n ماهِ آخر
export function aggregateMonthly(
  points: { createdAt: Date | string; value: number }[],
  n: number,
  now: Date = new Date()
): MonthlyPoint[] {
  const skeleton = buildLastNMonthsSkeleton(n, now);
  for (const p of points) {
    const key = monthKey(new Date(p.createdAt));
    const entry = skeleton.get(key);
    if (entry) {
      entry.value += p.value;
      entry.count += 1;
    }
  }
  return Array.from(skeleton.entries()).map(([, v]) => ({ label: v.label, value: v.value, count: v.count }));
}

// ---------- گزارش سود ----------

export type ProfitOrderLike = {
  total: number;
  discountTotal: number;
  shippingCost: number | null;
  cargoCost: number | null;
  items: { price: number; quantity: number; purchasePriceActual: number | null }[];
};

// سود از داده‌های موجود: درآمد ناخالص − تخفیف‌ها − هزینه‌ی ارسال/باربری − هزینه‌ی
// خرید واقعی اقلام خارجی (purchasePriceActual). قیمت تمام‌شده‌ی مزون ذخیره
// نمی‌شود، پس netProfit «حداقل سود محاسبه‌پذیر» است (سود واقعی پایین‌تر).
export function computeProfitMetrics(orders: ProfitOrderLike[]) {
  let revenue = 0;
  let discountTotalSum = 0;
  let shippingCargoCostSum = 0;
  let foreignCost = 0;
  let foreignRevenue = 0;

  for (const o of orders) {
    revenue += o.total;
    discountTotalSum += o.discountTotal;
    shippingCargoCostSum += (o.shippingCost ?? 0) + (o.cargoCost ?? 0);
    for (const item of o.items) {
      if (item.purchasePriceActual !== null && item.purchasePriceActual !== undefined) {
        foreignRevenue += item.price * item.quantity;
        foreignCost += item.purchasePriceActual * item.quantity;
      }
    }
  }

  return {
    revenue,
    discountTotalSum,
    shippingCargoCostSum,
    foreignRevenue,
    foreignCost,
    foreignProfit: foreignRevenue - foreignCost,
    netProfit: revenue - discountTotalSum - shippingCargoCostSum - foreignCost,
  };
}

// ---------- نرخ تبدیل ----------

// نرخ‌های تبدیل: بازدید محصول → سفارشِ پرداخت‌شده (بازاریابی) و کل کاربران →
// کاربرانی که حداقل یک سفارش پرداخت‌شده دارند (وفاداری/خریدارِ واقعی)
export function computeConversionRates(
  paidOrders30d: number,
  productViews30d: number,
  usersWithPaidOrder: number,
  totalUsers: number
) {
  return {
    visitorToOrder: productViews30d > 0 ? paidOrders30d / productViews30d : 0,
    visitorToOrderPercent: productViews30d > 0 ? (paidOrders30d / productViews30d) * 100 : 0,
    customerConversion: totalUsers > 0 ? usersWithPaidOrder / totalUsers : 0,
    customerConversionPercent: totalUsers > 0 ? (usersWithPaidOrder / totalUsers) * 100 : 0,
    usersWithPaidOrder,
    totalUsers,
  };
}
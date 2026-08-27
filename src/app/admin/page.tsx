import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  loadAlertThresholds,
  computeOrderAlert,
  STAGE_LABELS,
  type AlertableOrder,
  type OrderStage,
} from "@/lib/orderAlerts";
import { sendDueReassurancePings } from "@/lib/reassurancePing";
import { runPaymentDeadlineAutoCancel } from "@/lib/orderPaymentDeadline";
import { runAbandonedCartReminders } from "@/lib/abandonedCart";
import { checkLowStockAndAlert } from "@/lib/lowStockAlert";

function formatHours(h: number): string {
  if (h < 24) return `${Math.floor(h).toLocaleString("fa-IR")} ساعت`;
  return `${Math.floor(h / 24).toLocaleString("fa-IR")} روز و ${Math.floor(h % 24).toLocaleString("fa-IR")} ساعت`;
}

export default async function AdminDashboard() {
  const [productCount, userCount, orderCount, categoryCount, openOrders] = await Promise.all([
    prisma.product.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.category.count(),
    prisma.order.findMany({
      where: {
        OR: [
          { status: { notIn: ["CANCELLED", "DELIVERED", "RETURNED"] } },
          { status: "DELIVERED", returnRequest: { status: { in: ["PENDING", "APPROVED", "ITEM_RECEIVED"] } } },
        ],
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        itemsNegotiationStatus: true,
        itemsNegotiationRespondedAt: true,
        paidAt: true,
        receiptSubmittedAt: true,
        updatedAt: true,
        createdAt: true,
        total: true,
        user: { select: { name: true, email: true } },
        items: { select: { source: true } },
        shippingPayment: { select: { status: true, receiptSubmittedAt: true } },
        statusHistory: { select: { status: true, createdAt: true } },
        returnRequest: { select: { status: true, updatedAt: true } },
      },
    }),
  ]);

  const thresholds = await loadAlertThresholds();
  const now = new Date();
  const reassurancePingsSent = await sendDueReassurancePings(now);
  // مهلت پرداخت: چون پروژه cron نداره، همون‌جا که پینگ دلگرم‌کننده صدا زده
  // می‌شه (داشبورد ادمین) خودکار هم بررسی می‌شه -- سفارش‌های منقضی لغو می‌شن
  const deadlineResult = await runPaymentDeadlineAutoCancel(now);
  // یادآوریِ سبدِ رهاشده -- به همون دلیل (پروژه cron ندارد) از همین‌جا صدا زده می‌شود
  await runAbandonedCartReminders(now);
  // هشدارِ موجودیِ کم -- اختیاری (از تنظیمات روشن/خاموش می‌شه)، همون‌جا خودش چک می‌کنه
  await checkLowStockAndAlert();

  const alerted = openOrders
    .map((o) => ({ order: o, alert: computeOrderAlert(o as AlertableOrder, thresholds, now) }))
    .filter((x) => x.alert.stage !== null)
    .sort((a, b) => (b.alert.hoursSince ?? 0) - (a.alert.hoursSince ?? 0));

  const byStage = new Map<OrderStage, typeof alerted>();
  for (const item of alerted) {
    const stage = item.alert.stage!;
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage)!.push(item);
  }

  const alertCount = alerted.filter((x) => x.alert.level === "alert").length;
  const warnCount = alerted.filter((x) => x.alert.level === "warn").length;

  const stats = [
    { label: "محصولات مزون", value: productCount, href: "/admin/products" },
    { label: "کاربران", value: userCount, href: "/admin/users" },
    { label: "سفارش‌ها", value: orderCount, href: "/admin/orders" },
    { label: "دسته‌بندی‌ها", value: categoryCount, href: "/admin/categories" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">داشبورد ادمین</h1>
        <Link href="/admin/reports" className="text-sm text-[var(--color-wine)] hover:underline font-medium">
          مشاهده‌ی گزارشات کامل ←
        </Link>
      </div>

      {deadlineResult.cancelled > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {deadlineResult.cancelled.toLocaleString("fa-IR")} سفارش به دلیل عدم پرداخت در مهلت به‌صورت خودکار لغو شد.
        </div>
      )}
      {deadlineResult.warned > 0 && (
        <div className="bg-[var(--color-ochre)]/10 border border-[var(--color-ochre)]/30 rounded-lg p-3 text-sm text-[var(--color-ochre)]">
          {deadlineResult.warned.toLocaleString("fa-IR")} سفارش مهلت پرداخت ارسال منقضی شده دارد -- بررسی کنید.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="border cut-line rounded-lg p-4 bg-white hover:border-[var(--color-wine)] transition-colors"
          >
            <p className="text-2xl font-extrabold text-[var(--color-wine)]">{s.value.toLocaleString("fa-IR")}</p>
            <p className="text-sm text-[var(--color-muted)]">{s.label}</p>
          </Link>
        ))}
      </div>

      {reassurancePingsSent > 0 && (
        <p className="text-xs text-[var(--color-muted)] bg-[var(--color-linen-dim)] rounded-lg px-3 py-2">
          پیام دلگرم‌کننده‌ی خودکار برای {reassurancePingsSent.toLocaleString("fa-IR")} سفارش که مدتی از پیگیریش
          گذشته بود، همین الان برای مشتری ثبت شد.
        </p>
      )}

      {(alertCount > 0 || warnCount > 0) && (
        <div className="flex items-center gap-3">
          {alertCount > 0 && (
            <span className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
              ⚠️ {alertCount.toLocaleString("fa-IR")} سفارش گیرکرده — نیاز به پیگیری فوری
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-sm font-bold text-[var(--color-ochre)] bg-[var(--color-ochre)]/10 border border-[var(--color-ochre)] rounded-full px-3 py-1">
              ⏳ {warnCount.toLocaleString("fa-IR")} سفارش نیمه‌هشدار
            </span>
          )}
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">صف اقدام ادمین</h2>
          <Link href="/admin/settings" className="text-xs text-[var(--color-wine)] hover:underline">
            تنظیم آستانه‌های هشدار →
          </Link>
        </div>

        {alerted.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] border cut-line rounded-lg p-4 bg-white">
            هیچ سفارشی منتظر اقدام یا گیرکرده نیست. 🎉
          </p>
        ) : (
          <div className="space-y-5">
            {Array.from(byStage.entries()).map(([stage, items]) => (
              <div key={stage} className="border cut-line rounded-lg bg-white overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--color-linen-dim)] font-bold text-sm flex items-center justify-between">
                  <span>{STAGE_LABELS[stage]}</span>
                  <span className="text-xs text-[var(--color-muted)]">{items.length.toLocaleString("fa-IR")} سفارش</span>
                </div>
                <div className="divide-y divide-[var(--color-line)]">
                  {items.map(({ order, alert }) => (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[var(--color-linen-dim)] transition-colors"
                    >
                      <span>
                        سفارش #{order.id.slice(-8)} — {order.user.name ?? order.user.email}
                        <span className="text-[var(--color-muted)] mr-2 ml-2">
                          {order.total.toLocaleString("fa-IR")} تومان
                        </span>
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          alert.level === "alert"
                            ? "bg-red-100 text-red-700"
                            : alert.level === "warn"
                              ? "bg-[var(--color-ochre)]/15 text-[var(--color-ochre)]"
                              : "bg-[var(--color-linen-dim)] text-[var(--color-muted)]"
                        }`}
                      >
                        {formatHours(alert.hoursSince ?? 0)} منتظر
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

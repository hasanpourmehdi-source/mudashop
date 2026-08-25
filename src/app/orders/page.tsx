import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { customerOrderStatusLabel, shippingPaymentStatusLabel } from "@/lib/orderStatusMessages";
import { BuyAgainButton } from "@/components/BuyAgainButton";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پردازش",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

export default async function OrdersListPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: { items: true, shippingPayment: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">سفارش‌های من</h1>

      {orders.length === 0 ? (
        <p className="text-[var(--color-muted)] text-sm">هنوز سفارشی ثبت نکرده‌اید.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const canReorder =
              (order.status === "DELIVERED" || order.status === "CANCELLED") &&
              order.items.some(
                (i) =>
                  (i.source === "MAZON" && !!i.productId) ||
                  (i.source === "TRENDYOL" && !!i.externalId)
              );
            return (
              <div
                key={order.id}
                className="border cut-line rounded-lg p-4 bg-white hover:border-[var(--color-wine)] transition-colors"
              >
                <Link
                  href={`/orders/${order.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">سفارش #{order.id.slice(-8)}</span>
                    <div className="flex items-center gap-2">
                      {order.paymentStatus === "PENDING" && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--color-ochre)]/20 text-[var(--color-ochre)]">
                          در انتظار بررسی ادمین
                        </span>
                      )}
                      {order.paymentStatus === "AWAITING_PAYMENT" && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--color-ochre)]/20 text-[var(--color-ochre)]">
                          آماده پرداخت
                        </span>
                      )}
                      {order.paymentStatus === "AWAITING_VERIFICATION" && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--color-ochre)]/20 text-[var(--color-ochre)]">
                          در انتظار تأیید فیش
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          order.status === "CANCELLED"
                            ? "bg-red-100 text-red-700"
                            : "bg-[var(--color-linen-dim)] text-[var(--color-ink)]"
                        }`}
                      >
                        {order.shippingPayment && order.status === "PROCESSING"
                          ? shippingPaymentStatusLabel(order.shippingPayment.status)
                          : customerOrderStatusLabel(
                              order.status,
                              order.paymentStatus,
                              STATUS_LABELS[order.status],
                              order.items.some((i) => i.source === "TRENDYOL")
                            )}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] mb-2">
                    {order.items.length} قلم · {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                  </p>
                  <p className="font-bold text-[var(--color-wine)]">
                    {order.total.toLocaleString("fa-IR")} تومان
                  </p>
                </Link>
                {canReorder && (
                  <div className="mt-3 pt-3 border-t cut-line">
                    <BuyAgainButton orderId={order.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

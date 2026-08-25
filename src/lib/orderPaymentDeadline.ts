import { prisma } from "@/lib/prisma";
import { restoreOrderResources } from "@/lib/orderResources";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { PURCHASE_STARTED_STATUSES } from "@/lib/orderCancellation";
import type { OrderStatus } from "@prisma/client";

// مهلت پرداخت: وقتی ادمین هزینه‌ی نهایی (اقلام یا هزینه‌ی ارسال/باربری) رو اعلام
// می‌کنه، یه پنجره‌ی زمانی (PAYMENT_DEADLINE_H ساعت) به مشتری داده می‌شه تا واریز
// کنه. اگه تا اون مهلت واریز نکنه و هنوز خریدِ واقعی از فروشنده شروع نشده باشه
// (هیچ قلمی PURCHASED نشده)، سفارش به‌صورت خودکار لغو می‌شه و منابع (موجودی/
// کوپن/کیف‌پول) برمی‌گردن. چون پروژه cron نداره، این تابع از صفحه‌ای که ادمین
// زیاد بازش می‌کنه (لیست سفارشات) صدا زده می‌شه.
export type PaymentDeadlineOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentDeadlineAt: Date | null;
  hasExternalItems: boolean;
  items: { purchaseStatus: string }[];
  shippingPayment: { status: string } | null;
};

const TERMINAL_STATUSES = new Set(["CANCELLED", "DELIVERED", "RETURNED"]);

// پرداخت کاملاً تسویه شده یا نه: برای سفارش خارجی، فقط وقتی کامله که هم
// پرداخت اقلام PAID باشه هم پرداخت هزینه‌ی ارسال (اگه دور دوم داشته باشه)
export function isPaymentComplete(order: PaymentDeadlineOrder): boolean {
  if (order.paymentStatus !== "PAID") return false;
  if (order.hasExternalItems && order.shippingPayment && order.shippingPayment.status !== "PAID") {
    return false;
  }
  return true;
}

// آیا مهلت پرداخت گذشته و هنوز پرداخت تکمیل نشده؟ (تابع خالص -- فقط روی داده)
// deadlineH صرفاً برای سازگاری با امضای قبلیه و چون زمان مطلق توی
// paymentDeadlineAt ذخیره می‌شه، اینجا استفاده نمی‌شه
export function isPaymentAwaitingExpired(order: PaymentDeadlineOrder, now: Date): boolean {
  if (!order.paymentDeadlineAt) return false;
  if (order.paymentDeadlineAt.getTime() > now.getTime()) return false;
  if (isPaymentComplete(order)) return false;
  return true;
}

export function computePaymentDeadline(now: Date, deadlineH: number): Date {
  return new Date(now.getTime() + deadlineH * 60 * 60 * 1000);
}

export type PaymentDeadlineResult = {
  cancelled: number;
  warned: number;
  details: string[];
};

// پیدا کردن سفارش‌هایی که مهلت پرداختشون گذشته و هنوز تسویه نشده -- و عمل:
//  - اگه هنوز خریدی انجام نشده (هیچ قلمی PURCHASED نیست): لغو خودکار + رفاند
//  - اگه خرید شروع شده (اقلام PURCHASED شده ولی هزینه‌ی ارسال منقضی): لغو نمی‌شه
//    (پول ادمین هدر می‌رفت)، فقط یه بار به ادمین هشدار می‌ده
export async function runPaymentDeadlineAutoCancel(now: Date = new Date()): Promise<PaymentDeadlineResult> {
  const deadlineHStr = await getSiteSetting(SITE_SETTING_KEYS.PAYMENT_DEADLINE_H);
  const deadlineH = Number(deadlineHStr) || 48;

  const candidates = await prisma.order.findMany({
    where: {
      paymentDeadlineAt: { lte: now },
      status: { notIn: [...TERMINAL_STATUSES] as OrderStatus[] },
      OR: [
        { paymentStatus: { not: "PAID" } },
        { shippingPayment: { status: { in: ["AWAITING_PAYMENT", "AWAITING_VERIFICATION"] } } },
      ],
    },
    include: { items: true, shippingPayment: true },
  });

  let cancelled = 0;
  let warned = 0;
  const details: string[] = [];

  for (const order of candidates) {
    const wrapped: PaymentDeadlineOrder = {
      ...order,
      // hasExternalItems روی مدل ذخیره نمی‌شه -- از روی منبع اقلام مشتق می‌شه
      hasExternalItems: order.items.some((i) => i.source === "TRENDYOL"),
    };
    if (!isPaymentAwaitingExpired(wrapped, now)) continue;

    const purchaseStarted = order.items.some((i) => PURCHASE_STARTED_STATUSES.has(i.purchaseStatus));

    if (!purchaseStarted) {
      await prisma.$transaction(async (tx) => {
        await restoreOrderResources(tx, order);

        await tx.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED" },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: "CANCELLED",
            note: `لغو خودکار به دلیل عدم واریز وجه در مهلت مقرر (${deadlineH} ساعت)`,
          },
        });

        await tx.notification.create({
          data: {
            userId: order.userId,
            message: `سفارش #${order.id.slice(-8)} به دلیل عدم واریز وجه در مهلت تعیین‌شده به‌صورت خودکار لغو شد و موجودی/کوپن/کیف‌پول برگشت داده شد.`,
            link: `/orders/${order.id}`,
          },
        });
      });

      await notifyCustomerOutbound({
        userId: order.userId,
        eventType: "ORDER_CANCELLED",
        title: `سفارش #${order.id.slice(-8)} لغو شد`,
        body: `سفارش #${order.id.slice(-8)} به دلیل عدم واریز وجه در مهلت تعیین‌شده به‌صورت خودکار لغو شد و موجودی/کوپن/کیف‌پول برگشت داده شد.`,
      });

      await notifyAdminsOnce(
        `[لغو خودکار سفارش]`,
        `[لغو خودکار سفارش] سفارش #${order.id.slice(-8)} به دلیل عدم پرداخت در مهلت لغو شد (در صورت واریز کارت‌به‌کارت، وجه را دستی به مشتری برگردانید).`,
        `/admin/orders/${order.id}`
      );

      cancelled += 1;
      details.push(`سفارش #${order.id.slice(-8)} لغو خودکار شد`);
    } else {
      // خرید شروع شده -- لغو نمی‌کنیم، فقط هشدار یک‌باره به ادمین
      await notifyAdminsOnce(
        `[مهلت پرداخت ارسال منقضی]`,
        `[مهلت پرداخت هزینه ارسال سفارش #${order.id.slice(-8)} منقضی شد اما چون اقلام خریداری شده‌اند، سفارش لغو نشد -- بررسی کنید.`,
        `/admin/orders/${order.id}`
      );
      warned += 1;
      details.push(`سفارش #${order.id.slice(-8)} منقضی شد (هشدار ادمین)`);
    }
  }

  return { cancelled, warned, details };
}

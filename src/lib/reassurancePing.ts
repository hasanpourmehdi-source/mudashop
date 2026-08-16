import { prisma } from "@/lib/prisma";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { determineOrderStage, type AlertableOrder } from "@/lib/orderAlerts";

const REASSURANCE_MESSAGE =
  "پیام خودکار: سفارش شما در جریان است و طبق روال عادی در حال بررسی و پیگیری‌ست. اگه سوالی داری همین‌جا (توی بخش گفت‌وگو) بپرس.";

// اگه آخرین پیام گفت‌وگو از طرف مشتری بوده (و بعد از آخرین پیام ادمین)، یعنی
// یه سوال/پیام بی‌جواب مونده -- پیام دلگرم‌کننده‌ی عمومی توی این حالت به‌نظر
// بی‌توجه به حرف مشتری می‌رسه، پس متن جداگانه‌ای بهش اشاره می‌کنه
const UNANSWERED_MESSAGE_REASSURANCE =
  "پیام خودکار: پیام شما توی گفت‌وگوی این سفارش دیده شد -- به‌زودی پاسخ می‌دیم. خودِ سفارش هم طبق روال عادی در حال بررسی و پیگیری‌ست.";

type ReassuranceCandidate = AlertableOrder & {
  userId: string;
  updatedAt: Date;
  lastReassurancePingAt: Date | null;
  messages: { sender: "CUSTOMER" | "ADMIN"; createdAt: Date }[];
};

// لنگرِ «آخرین باری که مشتری چیزی ازمون شنید» -- تغییر وضعیت سفارش (updatedAt)،
// آخرین پیام ادمین توی گفت‌وگو، یا آخرین پینگ خودکار قبلی؛ هرکدوم جدیدتره.
// پیام مشتری خودش عمداً لحاظ نمی‌شه -- سکوت ادمین بعد از سوال مشتری هم باید
// باعث فرستادنِ پینگ بشه، نه ریست‌شدنش (فقط متنش فرق می‌کنه، نه زمانش)
function lastCustomerContactAt(order: ReassuranceCandidate, stageSince: Date | null): Date {
  const latestAdminMessage = order.messages.find((m) => m.sender === "ADMIN")?.createdAt;
  const candidates = [order.updatedAt, order.lastReassurancePingAt, latestAdminMessage, stageSince].filter(
    (d): d is Date => d instanceof Date
  );
  return candidates.reduce((latest, d) => (d > latest ? d : latest), candidates[0]);
}

function hasUnansweredCustomerMessage(order: ReassuranceCandidate): boolean {
  const latest = order.messages[0];
  if (!latest || latest.sender !== "CUSTOMER") return false;
  const latestAdminMessage = order.messages.find((m) => m.sender === "ADMIN")?.createdAt;
  return !latestAdminMessage || latest.createdAt > latestAdminMessage;
}

// برای هر سفارش بازِ (نه لغو/تحویل/مرجوع) که مدت طولانی‌ای خبری از سمت ما به
// مشتری نرسیده، یه پیام دلگرم‌کننده‌ی خودکار ثبت می‌کنه -- چون پروژه cron نداره،
// این تابع از صفحه‌ای که ادمین معمولاً زیاد بازش می‌کنه (داشبورد) صدا زده می‌شه
export async function sendDueReassurancePings(now: Date = new Date()): Promise<number> {
  const afterHoursStr = await getSiteSetting(SITE_SETTING_KEYS.REASSURANCE_PING_AFTER_H);
  const afterHours = Number(afterHoursStr) || Infinity;
  if (!Number.isFinite(afterHours)) return 0;

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: { notIn: ["CANCELLED", "DELIVERED", "RETURNED"] } },
        { status: "DELIVERED", returnRequest: { status: { in: ["PENDING", "APPROVED", "ITEM_RECEIVED"] } } },
      ],
    },
    select: {
      id: true,
      userId: true,
      status: true,
      paymentStatus: true,
      itemsNegotiationStatus: true,
      itemsNegotiationRespondedAt: true,
      paidAt: true,
      receiptSubmittedAt: true,
      updatedAt: true,
      createdAt: true,
      lastReassurancePingAt: true,
      items: { select: { source: true } },
      shippingPayment: { select: { status: true, receiptSubmittedAt: true } },
      statusHistory: { select: { status: true, createdAt: true } },
      returnRequest: { select: { status: true, updatedAt: true } },
      // همه‌ی پیام‌های اخیر (نه فقط ادمین) -- هم برای لنگرِ تماس (فقط پیام
      // ادمین) هم برای تشخیص «آخرین پیام از مشتریه و بی‌جواب مونده»
      messages: { orderBy: { createdAt: "desc" }, take: 20, select: { sender: true, createdAt: true } },
    },
  });

  let sentCount = 0;
  for (const order of orders) {
    const { since: stageSince } = determineOrderStage(order);
    const anchor = lastCustomerContactAt(order, stageSince ?? order.createdAt);
    const hoursSinceContact = (now.getTime() - anchor.getTime()) / (1000 * 60 * 60);
    if (hoursSinceContact < afterHours) continue;

    const message = hasUnansweredCustomerMessage(order) ? UNANSWERED_MESSAGE_REASSURANCE : REASSURANCE_MESSAGE;

    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { lastReassurancePingAt: now } }),
      prisma.orderStatusHistory.create({
        data: { orderId: order.id, status: order.status, note: message },
      }),
      prisma.notification.create({
        data: {
          userId: order.userId,
          message: `پیگیری سفارش #${order.id.slice(-8)}: هنوز در جریان است، منتظر بمانید`,
          link: `/orders/${order.id}`,
        },
      }),
    ]);
    sentCount += 1;
  }
  return sentCount;
}

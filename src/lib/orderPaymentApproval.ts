import { prisma } from "@/lib/prisma";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { applyReferralRewardIfEligible } from "@/lib/referral";
import { shippingPaymentStatusLabel } from "@/lib/orderStatusMessages";

// تأییدِ دورِ اولِ پرداخت (هزینه‌ی اقلام) -- هم از routeِ دستیِ ادمین
// (verify-payment) صدا زده می‌شه، هم از خودِ routeِ آپلودِ فیش وقتی «تأییدِ
// فیش‌های واریزی» از تنظیمات خاموش باشه (اون‌جا به‌جای موندن روی
// AWAITING_VERIFICATION، همون لحظه صدا زده می‌شه)
//
// گذارِ وضعیت شرطی و اتمیه (updateMany با فیلترِ paymentStatus) -- بدونش دو
// فراخوانیِ همپوشان (تأیید + رد توسط دو ادمین، یا آپلود فیش مسابقه با
// لغوِ خودکارِ ددلاین) می‌تونستن سفارشی که منابعش (موجودی/کوپن/کیف پول)
// برگشته رو دوباره PAID کنن یا نوتیفیکیشن/رویداد تکراری بسازن. false یعنی
// سفارش در وضعیت مورد انتظار نبود و هیچ اقدامی انجام نشد
export async function approveItemsPayment(orderId: string): Promise<boolean> {
  const now = new Date();
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: "AWAITING_VERIFICATION" },
    data: { paymentStatus: "PAID", paidAt: now },
  });
  if (claimed.count === 0) return false;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { userId: true, status: true },
  });
  await prisma.orderStatusHistory.create({
    data: { orderId, status: order.status, note: "پرداخت اقلام سفارش تأیید شد" },
  });
  const latestItemsEvent = await prisma.orderPaymentEvent.findFirst({
    where: { orderId, round: "items", paidAt: null },
    orderBy: { assignedAt: "desc" },
  });
  if (latestItemsEvent) {
    await prisma.orderPaymentEvent.update({ where: { id: latestItemsEvent.id }, data: { paidAt: now } });
  }
  const shortId = orderId.slice(-8);
  await prisma.notification.create({
    data: {
      userId: order.userId,
      message: `فیش پرداخت سفارش #${shortId} تأیید شد و سفارش شما در حال آماده‌سازیه.`,
      link: `/orders/${orderId}`,
    },
  });
  await notifyCustomerOutbound({
    userId: order.userId,
    eventType: "PAYMENT_RECEIVED",
    title: `پرداخت سفارش #${shortId} تأیید شد`,
    body: `فیش پرداخت سفارش #${shortId} تأیید شد و سفارش شما در حال آماده‌سازی است.`,
  });
  await applyReferralRewardIfEligible(orderId);
  return true;
}

// تأییدِ دورِ دومِ پرداخت (هزینه‌ی ارسال/باربریِ سفارشِ خارجی)
export async function approveShippingPayment(orderId: string): Promise<boolean> {
  const now = new Date();
  const claimed = await prisma.shippingPayment.updateMany({
    where: { orderId, status: "AWAITING_VERIFICATION" },
    data: { status: "PAID", paidAt: now },
  });
  if (claimed.count === 0) return false;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { userId: true, status: true },
  });
  const latestShippingEvent = await prisma.orderPaymentEvent.findFirst({
    where: { orderId, round: "shipping", paidAt: null },
    orderBy: { assignedAt: "desc" },
  });
  if (latestShippingEvent) {
    await prisma.orderPaymentEvent.update({ where: { id: latestShippingEvent.id }, data: { paidAt: now } });
  }
  await prisma.orderStatusHistory.create({
    data: { orderId, status: order.status, note: "فیش هزینه ارسال/باربری تأیید شد" },
  });
  const shortId = orderId.slice(-8);
  await prisma.notification.create({
    data: {
      userId: order.userId,
      message: `فیش هزینه ارسال سفارش #${shortId} تأیید شد -- سفارش شما «${shippingPaymentStatusLabel("PAID")}» قرار گرفت.`,
      link: `/orders/${orderId}`,
    },
  });
  return true;
}

import type { Prisma } from "@prisma/client";

// وقتی ادمین اقلام سفارش رو ویرایش می‌کنه، اگه سفارش از قبل منتظر پاسخ مشتری
// نبود، این ویرایش سفارش رو به همون حالت می‌بره + یه اعلان به مشتری می‌فرسته.
// اگه از قبل همون حالت بود (چند ویرایش پشت‌سرهم ادمین)، دوباره اعلان نمی‌فرسته.
// reason (اختیاری، مثلاً «این کالا ناموجود شد، این مورد مشابه رو پیشنهاد
// می‌کنیم») هم توی متن نوتیفیکیشن هم به‌عنوان یه ردیف OrderStatusHistory ثبت
// می‌شه -- تا مشتری دقیقاً بفهمه چرا منتظره، نه یه پیام عمومی همیشه‌یکسان
export async function markAwaitingCustomerReview(
  tx: Prisma.TransactionClient,
  orderId: string,
  reason?: string
) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const alreadyWaiting = order.itemsNegotiationStatus === "AWAITING_CUSTOMER_REVIEW";

  if (!alreadyWaiting) {
    await tx.order.update({
      where: { id: orderId },
      data: { itemsNegotiationStatus: "AWAITING_CUSTOMER_REVIEW" },
    });
  }

  // همیشه یه ردیف تاریخچه‌ی تازه ثبت کن -- نه فقط وقتی reason داده شده -- وگرنه
  // اگه ادمین بدون نوشتن دلیل ویرایش کنه، OrderTracking (که همیشه *آخرین*
  // ردیف تاریخچه رو به‌عنوان دلیلِ همین ویرایش نشون می‌ده) یه ردیفِ قدیمی و
  // کاملاً بی‌ربط (مثلاً از لحظه‌ی PENDING->PROCESSING) رو به‌جای توضیح این
  // ویرایش به مشتری نشون می‌ده
  await tx.orderStatusHistory.create({
    data: { orderId, status: order.status, note: reason ?? "منتظر تأیید شما روی تغییرات اقلام سفارش" },
  });

  if (!alreadyWaiting) {
    await tx.notification.create({
      data: {
        userId: order.userId,
        message: reason
          ? `تغییری توی اقلام سفارش #${orderId.slice(-8)} اعمال شد: ${reason}`
          : `ادمین اقلام سفارش #${orderId.slice(-8)} رو ویرایش کرد -- لطفاً بررسی و تأیید کنید.`,
        link: `/orders/${orderId}`,
      },
    });
  }
}

// همون قرینه برای سمت مشتری -- وقتی مشتری خودش اقلام رو ویرایش می‌کنه، نوبت
// بررسی می‌افته گردن ادمین (و همه‌ی ادمین‌ها اعلان می‌گیرن، نه فقط یکی)
export async function markAwaitingAdminReview(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.itemsNegotiationStatus === "AWAITING_ADMIN_REVIEW") return;

  await tx.order.update({
    where: { id: orderId },
    data: { itemsNegotiationStatus: "AWAITING_ADMIN_REVIEW", itemsNegotiationRespondedAt: new Date() },
  });
  const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length > 0) {
    await tx.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        message: `مشتری اقلام سفارش #${orderId.slice(-8)} رو ویرایش کرد -- لطفاً بررسی کنید.`,
        link: `/admin/orders/${orderId}`,
      })),
    });
  }
}

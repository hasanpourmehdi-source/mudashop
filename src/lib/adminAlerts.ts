import { prisma } from "@/lib/prisma";

const DEDUPE_WINDOW_HOURS = 24;

// یه هشدار به همه‌ی ادمین‌ها می‌فرسته (از همون سیستم اعلان زنگوله‌ای که برای
// موجودی/سفارش داریم استفاده می‌کنه)، ولی اگه توی ۲۴ ساعت اخیر همین هشدار
// (با همون prefix) قبلاً فرستاده شده باشه، دوباره نمی‌فرسته -- وگرنه اگه یه
// مشکل مدام تکرار بشه (مثلاً هر بار کاربر صفحه‌ی ترندیول رو باز کنه)، ادمین
// غرق ده‌ها اعلان تکراری می‌شه.
export async function notifyAdminsOnce(messagePrefix: string, fullMessage: string, link?: string) {
  const since = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);

  const alreadySent = await prisma.notification.findFirst({
    where: {
      message: { startsWith: messagePrefix },
      createdAt: { gte: since },
    },
  });
  if (alreadySent) return;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      message: fullMessage,
      link,
    })),
  });
}

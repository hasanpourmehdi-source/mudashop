import { prisma } from "@/lib/prisma";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";

// ================= یادآوری سبد خرید رهاشده =================
// چون سبدِ خرید فقط توی localStorage کلاینته، برای یادآوریِ زمان‌محور یک
// «عکسِ لحظه‌ای» ازش (فقط برای کاربرهای لاگین‌کرده) توی CartSnapshot نگه
// می‌داریم (src/components/CartUserSync.tsx آن را sync می‌کند). این پروژه
// cron ندارد، پس دقیقاً مثل مهلتِ پرداخت/پینگِ دلگرم‌کننده، از داشبورد ادمین
// (صفحه‌ای که زیاد باز می‌شود) صدا زده می‌شود.

export type CartSnapshotLike = {
  updatedAt: Date;
  remindedAt: Date | null;
};

// خالص: آیا این سبد باید یادآوری بگیرد؟ فقط سبدهایی که از آخرین تغییرشان
// حداقل thresholdH ساعت گذشته و از آخرین یادآوری (اگه بوده) هم به همون اندازه گذشته
export function shouldRemindCart(snapshot: CartSnapshotLike, now: Date, thresholdH: number): boolean {
  const cutoff = new Date(now.getTime() - thresholdH * 60 * 60 * 1000);
  if (snapshot.updatedAt > cutoff) return false;
  if (snapshot.remindedAt && snapshot.remindedAt > cutoff) return false;
  return true;
}

export type AbandonedCartItem = { title: string; quantity: number };

export function buildAbandonedCartMessage(items: AbandonedCartItem[]): { title: string; body: string } {
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const firstTitle = items[0]?.title ?? "کالا";
  const extra = items.length > 1 ? ` و ${(items.length - 1).toLocaleString("fa-IR")} کالای دیگر` : "";
  return {
    title: "سبد خریدت رو یادت رفت؟",
    body: `${count.toLocaleString("fa-IR")} کالا (${firstTitle}${extra}) هنوز توی سبد خریدته -- برای تکمیل سفارش برگرد به سایت.`,
  };
}

export async function runAbandonedCartReminders(now: Date = new Date()): Promise<{ sent: number }> {
  const thresholdH = Number(await getSiteSetting(SITE_SETTING_KEYS.ABANDONED_CART_AFTER_H)) || 24;

  const candidates = await prisma.cartSnapshot.findMany({
    where: { remindedAt: null },
  });

  let sent = 0;
  for (const snap of candidates) {
    if (!shouldRemindCart(snap, now, thresholdH)) continue;

    let items: AbandonedCartItem[] = [];
    try {
      items = (JSON.parse(snap.itemsJson) as { title: string; quantity: number }[]).map((i) => ({
        title: i.title,
        quantity: i.quantity,
      }));
    } catch {
      continue;
    }
    if (items.length === 0) continue;

    const { title, body } = buildAbandonedCartMessage(items);

    await prisma.$transaction([
      prisma.cartSnapshot.update({ where: { id: snap.id }, data: { remindedAt: now } }),
      prisma.notification.create({ data: { userId: snap.userId, message: body, link: "/cart" } }),
    ]);
    await notifyCustomerOutbound({ userId: snap.userId, eventType: "CART_ABANDONED", title, body });
    sent += 1;
  }

  return { sent };
}

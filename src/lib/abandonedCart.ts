import { prisma } from "@/lib/prisma";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";

// ================= یادآوری سبد خرید رهاشده (دنباله‌ی ۳ مرحله‌ای) =================
// چون سبدِ خرید فقط توی localStorage کلاینته، برای یادآوریِ زمان‌محور یک
// «عکسِ لحظه‌ای» ازش (فقط برای کاربرهای لاگین‌کرده) توی CartSnapshot نگه
// می‌داریم (src/components/CartUserSync.tsx آن را sync می‌کند). این پروژه
// cron ندارد، پس دقیقاً مثل مهلتِ پرداخت/پینگِ دلگرم‌کننده، از داشبورد ادمین
// (صفحه‌ای که زیاد باز می‌شود) صدا زده می‌شود.
//
// سه مرحله (هرکدوم فقط وقتی مرحله‌ی قبلی رفته و آستانه‌ی زمانیِ خودش هم از
// آخرین تغییرِ سبد گذشته باشه، دقیقاً یکی در هر اجرا -- برای جلوگیری از
// یک‌جا فرستادنِ چند مرحله اگه این تابع مدتی صدا زده نشده باشه):
//  ۱. یادآوریِ نرم به مشتری
//  ۲. یادآوریِ فوریت به مشتری -- فقط اگه واقعاً موجودیِ کمی مونده باشه
//     (چک زنده از DB، نه ادعای ساختگی) به همون اشاره می‌کنه
//  ۳. دیگه به مشتری پیامی نمی‌ره -- به ادمین اطلاع داده می‌شه که این لحظه
//     ممکنه وقتِ مناسبی برای پیشنهادِ دستیِ یه کد تخفیف باشه؛ تصمیم با ادمینه

export type CartSnapshotLike = {
  updatedAt: Date;
  reminderStage: number;
};

const LOW_STOCK_URGENCY_THRESHOLD = 5;

function hoursSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
}

// خالص: این سبد الان دقیقاً کدوم مرحله رو باید بگیره؟ null یعنی هنوز زوده
export function nextReminderStage(
  snapshot: CartSnapshotLike,
  now: Date,
  thresholds: { stage1H: number; stage2H: number; stage3H: number }
): 1 | 2 | 3 | null {
  const h = hoursSince(snapshot.updatedAt, now);
  if (snapshot.reminderStage === 0 && h >= thresholds.stage1H) return 1;
  if (snapshot.reminderStage === 1 && h >= thresholds.stage2H) return 2;
  if (snapshot.reminderStage === 2 && h >= thresholds.stage3H) return 3;
  return null;
}

export type AbandonedCartItem = {
  title: string;
  quantity: number;
  source?: string;
  productId?: string;
  variantId?: string;
};

export function buildStage1Message(items: AbandonedCartItem[]): { title: string; body: string } {
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const firstTitle = items[0]?.title ?? "کالا";
  const extra = items.length > 1 ? ` و ${(items.length - 1).toLocaleString("fa-IR")} کالای دیگر` : "";
  return {
    title: "سبد خریدت رو یادت رفت؟",
    body: `${count.toLocaleString("fa-IR")} کالا (${firstTitle}${extra}) هنوز توی سبد خریدته -- برای تکمیل سفارش برگرد به سایت.`,
  };
}

export function buildStage2Message(
  items: AbandonedCartItem[],
  lowStockTitles: string[]
): { title: string; body: string } {
  if (lowStockTitles.length > 0) {
    const label =
      lowStockTitles.length === 1
        ? `«${lowStockTitles[0]}»`
        : `«${lowStockTitles[0]}» و ${(lowStockTitles.length - 1).toLocaleString("fa-IR")} کالای دیگر`;
    return {
      title: "موجودی محدوده!",
      body: `موجودیِ ${label} توی سبد خریدت داره تموم می‌شه -- اگه هنوز می‌خوایش، بهتره زودتر سفارش رو ثبت کنی.`,
    };
  }
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  return {
    title: "هنوز منتظرته",
    body: `${count.toLocaleString("fa-IR")} کالا هنوز توی سبد خریدته -- نمی‌خوای همین حالا سفارشش رو ثبت کنی؟`,
  };
}

// چکِ زنده‌ی موجودی -- فقط اقلامِ مزون که variantId دارن (سنپ‌شاتِ قدیمی یا
// اقلامِ ترندیول این اطلاعات رو ندارن، پس رد می‌شن -- بهتر از فرضِ اشتباه)
async function findLowStockTitles(items: AbandonedCartItem[]): Promise<string[]> {
  const variantIds = items
    .filter((i) => i.source === "MAZON" && i.variantId)
    .map((i) => i.variantId!) as string[];
  if (variantIds.length === 0) return [];

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, stock: { gt: 0, lte: LOW_STOCK_URGENCY_THRESHOLD } },
    select: { id: true },
  });
  const lowStockVariantIds = new Set(variants.map((v) => v.id));
  return items.filter((i) => i.variantId && lowStockVariantIds.has(i.variantId)).map((i) => i.title);
}

function parseItems(itemsJson: string): AbandonedCartItem[] {
  try {
    return JSON.parse(itemsJson) as AbandonedCartItem[];
  } catch {
    return [];
  }
}

export async function runAbandonedCartReminders(now: Date = new Date()): Promise<{ sent: number }> {
  const [stage1H, stage2H, stage3H] = await Promise.all([
    getSiteSetting(SITE_SETTING_KEYS.ABANDONED_CART_AFTER_H),
    getSiteSetting(SITE_SETTING_KEYS.ABANDONED_CART_STAGE2_H),
    getSiteSetting(SITE_SETTING_KEYS.ABANDONED_CART_STAGE3_H),
  ]);
  const thresholds = {
    stage1H: Number(stage1H) || 24,
    stage2H: Number(stage2H) || 72,
    stage3H: Number(stage3H) || 168,
  };

  // اسنپ‌شاتی که سبدش خالیه (فقط savedForLater داره) هیچ‌وقت reminderStage
  // جلو نمی‌ره (پایین: items.length===0 => continue)، پس بدونِ این فیلتر برای
  // همیشه توی هر اجرا دوباره fetch و بی‌نتیجه رد می‌شه -- با رشدِ جدول یه
  // اسکنِ مرده‌ی تکرارشونده می‌شه
  const candidates = await prisma.cartSnapshot.findMany({
    where: { reminderStage: { lt: 3 }, itemsJson: { not: "[]" } },
    include: { user: { select: { name: true, email: true } } },
  });

  let sent = 0;
  for (const snap of candidates) {
    const stage = nextReminderStage(snap, now, thresholds);
    if (!stage) continue;

    const items = parseItems(snap.itemsJson);
    if (items.length === 0) continue;

    // این تابع از داشبوردِ ادمین (که ممکنه چندتا تب/کاربر هم‌زمان باز باشه)
    // صدا زده می‌شه، نه یه cron تکی -- پس دو اجرای هم‌زمان می‌تونن هر دو همین
    // snapshot رو با همون reminderStage قدیمی بخونن و هر دو بخوان یادآوری
    // بفرستن. آپدیتِ شرطی (reminderStage قدیمی توی where) این رو اتمیک می‌کنه:
    // فقط اولین اجرا واقعاً ردیف رو عوض می‌کنه، بقیه count=0 می‌گیرن و رد می‌شن.
    if (stage === 1) {
      const { title, body } = buildStage1Message(items);
      const claimed = await prisma.$transaction(async (tx) => {
        const updated = await tx.cartSnapshot.updateMany({
          where: { id: snap.id, reminderStage: snap.reminderStage },
          data: { reminderStage: 1, lastReminderAt: now },
        });
        if (updated.count === 0) return false;
        await tx.notification.create({ data: { userId: snap.userId, message: body, link: "/cart" } });
        return true;
      });
      if (!claimed) continue;
      await notifyCustomerOutbound({ userId: snap.userId, eventType: "CART_ABANDONED", title, body });
      sent += 1;
    } else if (stage === 2) {
      const lowStockTitles = await findLowStockTitles(items);
      const { title, body } = buildStage2Message(items, lowStockTitles);
      const claimed = await prisma.$transaction(async (tx) => {
        const updated = await tx.cartSnapshot.updateMany({
          where: { id: snap.id, reminderStage: snap.reminderStage },
          data: { reminderStage: 2, lastReminderAt: now },
        });
        if (updated.count === 0) return false;
        await tx.notification.create({ data: { userId: snap.userId, message: body, link: "/cart" } });
        return true;
      });
      if (!claimed) continue;
      await notifyCustomerOutbound({ userId: snap.userId, eventType: "CART_ABANDONED", title, body });
      sent += 1;
    } else {
      // مرحله‌ی سوم: دیگه به مشتری پیامی نمی‌ره -- فقط ادمین مطلع می‌شه
      const updated = await prisma.cartSnapshot.updateMany({
        where: { id: snap.id, reminderStage: snap.reminderStage },
        data: { reminderStage: 3, lastReminderAt: now },
      });
      if (updated.count === 0) continue;
      const count = items.reduce((sum, i) => sum + i.quantity, 0);
      const itemsSummary = items
        .slice(0, 3)
        .map((i) => i.title)
        .join("، ");
      const customerLabel = snap.user.name || snap.user.email;
      const prefix = `[نامزدِ کد تخفیف] ${snap.userId}`;
      await notifyAdminsOnce(
        prefix,
        `${prefix}: ${customerLabel} هنوز سفارشش رو ثبت نکرده با این‌که ${(thresholds.stage3H / 24).toFixed(0)} روزه سبدش (${count.toLocaleString(
          "fa-IR"
        )} کالا: ${itemsSummary}) دست‌نخورده مونده -- شاید وقتِ خوبی برای پیشنهادِ دستیِ یه کد تخفیف باشه (اختیاریه، خودت تشخیص بده)`,
        "/admin/support"
      );
      sent += 1;
    }
  }

  return { sent };
}

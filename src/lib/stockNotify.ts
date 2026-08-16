import { prisma } from "@/lib/prisma";

const PRIORITY_WINDOW_HOURS = 24;

// از روی توضیح ترکیبی («سایز: 36 / رنگ: سبز») واریانتِ دقیقاً منطبق این محصول رو پیدا می‌کنه
// و موجودیش رو برمی‌گردونه. اگه واریانتی با این ترکیب دقیق پیدا نشه، null برمی‌گردونه.
async function findVariantStockForDescription(
  productId: string,
  description: string
): Promise<number | null> {
  const parts = description.split(" / ").map((p) => {
    const [attribute, value] = p.split(": ");
    return { attribute: attribute?.trim() ?? "", value: value?.trim() ?? "" };
  });

  const variants = await prisma.productVariant.findMany({
    where: { productId },
    include: { values: true },
  });

  const match = variants.find(
    (v) =>
      v.values.length === parts.length &&
      parts.every((p) => v.values.some((vv) => vv.attribute === p.attribute && vv.value === p.value))
  );

  return match ? match.stock : null;
}

// پیام و اولویت رو به نفر بعدیِ صف (قدیمی‌ترین درخواستِ هنوز اطلاع‌داده‌نشده) می‌ده
async function reserveNextInQueue(productId: string, description: string) {
  const next = await prisma.stockNotification.findFirst({
    where: { productId, description, notifiedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { title: true, slug: true },
  });
  if (!product) return;

  const reservedUntil = new Date(Date.now() + PRIORITY_WINDOW_HOURS * 60 * 60 * 1000);
  const deadlineText = reservedUntil.toLocaleString("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  await prisma.$transaction([
    prisma.stockNotification.update({
      where: { id: next.id },
      data: { notifiedAt: new Date(), reservedUntil },
    }),
    prisma.notification.create({
      data: {
        userId: next.userId,
        message: `${product.title} — ${next.description} موجود شد! چون زودتر از بقیه درخواست داده بودی، اول به تو خبر دادیم. پیشنهاد می‌کنیم زودتر بخری (تا ${deadlineText} اولویت اطلاع‌رسانی داری، ولی موجودی برای بقیه هم آزاده).`,
        link: `/products/mazon/${product.slug}`,
      },
    }),
  ]);
}

// برای یه توضیح مشخص: اگه الان یه اولویتِ فعال (هنوز منقضی‌نشده) وجود داره، کاری نمی‌کنیم.
// وگرنه، اگه موجودی هست، نوبت رو به نفر بعدیِ صف می‌ده.
async function advanceQueueForDescription(productId: string, description: string) {
  const now = new Date();

  const activeReservation = await prisma.stockNotification.findFirst({
    where: { productId, description, reservedUntil: { gte: now } },
  });
  if (activeReservation) return; // یه نفر الان اولویت داره، هنوز مهلتش تموم نشده

  const stock = await findVariantStockForDescription(productId, description);
  if (!stock || stock <= 0) return; // موجودیی نیست که خبر بدیم

  await reserveNextInQueue(productId, description);
}

// وقتی موجودی یک یا چند ترکیب از صفر بیشتر می‌شه صدا زده می‌شه (بعد از ثبت موجودی جدید توسط ادمین)
export async function notifyStockSubscribers(productId: string, variantIds: string[]) {
  if (variantIds.length === 0) return;

  const values = await prisma.productVariantValue.findMany({
    where: { variantId: { in: variantIds } },
    select: { attribute: true, value: true, variant: { select: { id: true } } },
  });

  // برای هر واریانتِ تغییرکرده، مجموعه‌ی مقادیرش رو جمع می‌کنیم
  const byVariant = new Map<string, string[]>();
  for (const v of values) {
    const key = v.variant.id;
    if (!byVariant.has(key)) byVariant.set(key, []);
    byVariant.get(key)!.push(`${v.attribute}: ${v.value}`);
  }

  // توضیحِ ذخیره‌شده روی StockNotification با هر ترتیبی که کاربر انتخاب کرده ساخته شده،
  // پس به‌جای ساختن یه رشته‌ی با ترتیب ثابت، توضیح‌های پندینگ رو می‌گیریم و به‌صورت
  // مجموعه‌ای (بدون توجه به ترتیب) با واریانت‌های تغییرکرده مقایسه می‌کنیم
  const pendingDescriptions = await prisma.stockNotification.findMany({
    where: { productId, notifiedAt: null },
    select: { description: true },
    distinct: ["description"],
  });

  const changedValueSets = Array.from(byVariant.values()).map(
    (parts) => new Set(parts.map((p) => p.trim()))
  );

  for (const { description } of pendingDescriptions) {
    const descParts = new Set(description.split(" / ").map((p) => p.trim()));
    const matchesAChangedVariant = changedValueSets.some(
      (set) => set.size === descParts.size && Array.from(descParts).every((p) => set.has(p))
    );
    if (matchesAChangedVariant) {
      await advanceQueueForDescription(productId, description);
    }
  }
}

// هر بار که مهلتِ اولویتِ یه‌نفر تموم می‌شه، باید نوبت به نفر بعدی برسه -- ولی چون کرون‌جاب نداریم،
// این تابع رو موقع بازدید صفحه محصول یا باز کردن پنل ادمین صدا می‌زنیم تا صف‌های منقضی‌شده جلو برن
export async function advanceExpiredReservationQueues(productId: string) {
  const expired = await prisma.stockNotification.findMany({
    where: { productId, reservedUntil: { lt: new Date() } },
    select: { description: true },
    distinct: ["description"],
  });

  for (const { description } of expired) {
    await advanceQueueForDescription(productId, description);
  }
}

// نسخه‌ی همه‌ی محصولات -- برای صفحه‌ی ادمین که همه‌ی درخواست‌ها رو یه‌جا می‌بینه
export async function advanceAllExpiredReservationQueues() {
  const products = await prisma.stockNotification.findMany({
    where: { reservedUntil: { lt: new Date() } },
    select: { productId: true },
    distinct: ["productId"],
  });
  for (const { productId } of products) {
    await advanceExpiredReservationQueues(productId);
  }
}

import { prisma } from "@/lib/prisma";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { getSiteSetting, getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";

// هشدارِ موجودیِ کم -- اختیاری (پیش‌فرض خاموش، از تنظیمات روشن می‌شه). چون
// پروژه cron نداره، دقیقاً مثلِ یادآوریِ سبدِ رهاشده/مهلتِ پرداخت، از داشبوردِ
// ادمین (صفحه‌ای که زیاد باز می‌شه) صدا زده می‌شه. برخلافِ اون‌ها نیازی به
// فیلدِ تازه‌ی دیتابیس نداره -- همون دی‌دوپِ ۲۴ساعته‌ی notifyAdminsOnce (کلیدشده
// با شناسه‌ی خودِ ترکیب) کافیه: تا وقتی موجودی هنوز کمه، حداکثر روزی یه‌بار
// یادآوری می‌شه؛ اگه شارژ بشه و دوباره کم بشه، طبیعتاً یه پیامِ تازه می‌ره
export async function checkLowStockAndAlert(): Promise<void> {
  if (!(await getSiteSettingBool(SITE_SETTING_KEYS.LOW_STOCK_ALERT_ENABLED))) return;

  const threshold = Number(await getSiteSetting(SITE_SETTING_KEYS.LOW_STOCK_ALERT_THRESHOLD)) || 5;

  const lowStockVariants = await prisma.productVariant.findMany({
    where: {
      stock: { gt: 0, lte: threshold },
      product: { isActive: true },
    },
    select: {
      id: true,
      stock: true,
      product: { select: { title: true } },
      values: { select: { attribute: true, value: true } },
    },
    take: 50, // محضِ احتیاط -- سقفی برای این‌که یه فروشگاهِ خیلی بزرگ توی یه اجرا صدها اعلان نسازه
  });

  for (const variant of lowStockVariants) {
    const label = variant.values.map((v) => `${v.attribute}: ${v.value}`).join(" / ");
    const prefix = `[موجودی کم] ${variant.id}`;
    await notifyAdminsOnce(
      prefix,
      `${prefix} -- «${variant.product.title}»${label ? ` (${label})` : ""} فقط ${variant.stock.toLocaleString(
        "fa-IR"
      )} عدد موجودی داره`,
      "/admin/products"
    );
  }
}

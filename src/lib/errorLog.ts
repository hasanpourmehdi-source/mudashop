import { prisma } from "@/lib/prisma";
import { notifyAdminsOnce } from "@/lib/adminAlerts";

// نسخه‌ی خودمیزبانِ ساده‌ی چیزی مثل Sentry -- ثبتِ خطا توی دیتابیس + یه اعلانِ
// یک‌باره به ادمین (با notifyAdminsOnce که خودش دوباره‌کاری رو در ۲۴ ساعت
// جلو می‌گیره، پس اگه یه خطای تکراری صد بار رخ بده، ادمین صد تا اعلان نمی‌گیره)
export async function logServerError(opts: {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  source: "SERVER" | "CLIENT";
}): Promise<void> {
  try {
    await prisma.errorLog.create({
      data: {
        message: opts.message.slice(0, 2000),
        stack: opts.stack?.slice(0, 8000),
        context: opts.context ? JSON.stringify(opts.context).slice(0, 2000) : null,
        source: opts.source,
      },
    });

    // برای هر پیامِ خطای متفاوت، حداکثر یه اعلان در ۲۴ ساعت -- خودِ ۶۰ کاراکترِ
    // اول به‌عنوان کلیدِ دوباره‌کاری کافیه (خطاهای واقعاً متفاوت معمولاً پیامِ
    // اولشون فرق می‌کنه)
    const key = `خطای سرور: ${opts.message.slice(0, 60)}`;
    await notifyAdminsOnce(key, `${key}${opts.message.length > 60 ? "..." : ""}`, "/admin/error-log");
  } catch {
    // اگه خودِ لاگ‌کردن هم خطا داد، نباید جریانِ اصلی رو بترکونه
  }
}

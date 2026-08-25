import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { deliverEmail } from "@/lib/outboundNotify";

// دقیقاً همون الگوی لینک بازیابی رمز (forgot-password) -- توکن تصادفی، یک
// ساعت اعتبار، یک‌بار مصرف. هدف: مطمئن شویم ایمیلِ ثبت‌شده واقعاً متعلق به
// خودِ کاربر است، وگرنه اعلان‌های حساس (تأیید سفارش، بازیابی رمز) به آدرس
// اشتباه می‌رود و مشتری هیچ‌وقت نمی‌فهمد.
const TOKEN_TTL_MS = 60 * 60 * 1000; // ۱ ساعت
// جلوگیری از spam-click روی «ارسال دوباره» -- حداقل این‌قدر فاصله بین دو ایمیل
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

export async function sendVerificationEmail(opts: {
  userId: string;
  email: string;
  name: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const recent = await prisma.emailVerificationToken.findFirst({
    where: { userId: opts.userId, usedAt: null, createdAt: { gte: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return { ok: false, error: "همین الان یه ایمیل تأیید فرستاده شده -- چند دقیقه دیگه دوباره امتحان کن." };
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: { userId: opts.userId, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const link = `${process.env.NEXTAUTH_URL ?? ""}/auth/verify-email?token=${token}`;
  const name = opts.name?.trim() || "کاربر گرامی";

  await deliverEmail({
    to: opts.email,
    subject: "تأیید ایمیل مُداشاپ",
    body: `${name}، برای تأیید ایمیل حساب مُداشاپت روی این لینک بزن (تا ۱ ساعت معتبره):\n${link}\n\nاگه خودت ثبت‌نام نکردی، این ایمیل رو نادیده بگیر.`,
  });

  return { ok: true };
}

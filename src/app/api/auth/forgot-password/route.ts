import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimitOrNull, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { verifyCaptcha } from "@/lib/captcha";
import { deliverEmail } from "@/lib/outboundNotify";

const schema = z.object({
  email: z.string().email("ایمیل معتبر نیست"),
  captchaId: z.string().min(1, "کد امنیتی الزامی است"),
  captchaAnswer: z.string().min(1, "پاسخ کد امنیتی الزامی است"),
});

const TOKEN_TTL_MS = 60 * 60 * 1000; // ۱ ساعت

export async function POST(req: Request) {
  const limited = rateLimitOrNull(req, "FORGOT_PASSWORD");
  if (limited) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE(limited.retryAfterSeconds) },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ایمیل معتبر نیست" }, { status: 400 });
  }

  const { email, captchaId, captchaAnswer } = parsed.data;

  if (!verifyCaptcha(captchaId, captchaAnswer)) {
    return NextResponse.json({ error: "کد امنیتی اشتباه است -- لطفاً دوباره امتحان کنید" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // عمداً حتی اگه کاربر پیدا نشه، همون پیام موفقیت برمی‌گردونیم (نه خطا) --
  // که کسی نتونه با این فرم بفهمه چه ایمیلی توی سیستم ثبت‌نام کرده یا نه
  if (!user || !user.password) {
    return NextResponse.json({ success: true, devResetLink: null });
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const resetLink = `${process.env.NEXTAUTH_URL ?? ""}/auth/reset-password?token=${token}`;

  // ارسالِ واقعیِ ایمیل -- best-effort (توی try/catch، مثلِ الگوی emailVerification.ts)
  // تا خطای پرووایدر باعثِ شکستِ کلِ درخواست نشه؛ مشتری همیشه پیامِ موفقیت می‌بینه
  try {
    await deliverEmail({
      to: email,
      subject: "بازیابی رمز عبور مُداشاپ",
      body: `برای بازیابی رمزِ عبورتون روی لینکِ زیر بزنید (تا ۱ ساعت معتبره):\n${resetLink}`,
    });
  } catch (err) {
    console.error("خطا در ارسالِ ایمیلِ بازیابیِ رمز:", err);
  }

  // توی محیط توسعه سرویس ایمیل واقعی معمولاً کانفیگ نشده؛ لینک رو توی جواب API
  // هم برمی‌گردونیم تا قابل تست باشه. در پروداکشن این هیچ‌وقت نباید برگرده --
  // برگشت لینک به هر کسی = تصاحب حساب.
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    console.log(`[dev] لینک بازیابی رمز برای ${email}: ${resetLink}`);
  }

  return NextResponse.json({ success: true, devResetLink: isDev ? resetLink : null });
}

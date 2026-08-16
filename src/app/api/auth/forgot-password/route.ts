import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email("ایمیل معتبر نیست"),
});

const TOKEN_TTL_MS = 60 * 60 * 1000; // ۱ ساعت

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ایمیل معتبر نیست" }, { status: 400 });
  }

  const { email } = parsed.data;
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

  // نکته مهم: اینجا سرویس ایمیل واقعی نداریم (پروژه در حالت توسعه‌ست)
  // پس به‌جای ارسال ایمیل، لینک رو مستقیم توی جواب API برمی‌گردونیم تا تست بشه.
  // توی محیط پروداکشن واقعی، این خط باید با ارسال ایمیل واقعی جایگزین بشه
  // و devResetLink اصلاً توی جواب برنگرده.
  console.log(`[dev] لینک بازیابی رمز برای ${email}: ${resetLink}`);

  return NextResponse.json({ success: true, devResetLink: resetLink });
}

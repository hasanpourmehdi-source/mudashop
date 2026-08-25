import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ token: z.string().min(1, "توکن نامعتبر است") });

// دقیقاً همون الگوی reset-password/route.ts -- توکن یک‌بارمصرف و منقضی‌شدنی
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const { token } = parsed.data;
  const verificationToken = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "لینک تأیید نامعتبر یا منقضی‌شده است. از پروفایل دوباره درخواست بده." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: verificationToken.userId }, data: { emailVerified: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: verificationToken.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ success: true });
}

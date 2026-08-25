import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/emailVerification";

// درخواستِ ارسالِ دوباره‌ی ایمیل تأیید -- فقط برای کاربر لاگین‌شده‌ی خودش
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ error: "ایمیل شما قبلاً تأیید شده است" }, { status: 400 });

  const result = await sendVerificationEmail({ userId: user.id, email: user.email, name: user.name });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 429 });

  return NextResponse.json({ success: true });
}

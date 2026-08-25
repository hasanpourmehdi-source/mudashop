import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// وضعیت تأییدِ ایمیلِ کاربرِ لاگین‌شده -- برای نمایشِ پیشاپیشِ هشدار توی
// چک‌اوت، قبل از این‌که کاربر کل فرم رو پر کند و فقط توی مرحله‌ی آخر بفهمد
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ verified: true });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  return NextResponse.json({ verified: !!user?.emailVerified });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// تعداد پیام‌های نخوانده‌ی ادمین برای بجِ دکمه‌ی شناور چت (سبک -- برای پولینگ)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ unread: 0 });
  }

  const unread = await prisma.supportMessage.count({
    where: { userId: session.user.id, sender: "ADMIN", customerRead: false },
  });

  return NextResponse.json({ unread });
}
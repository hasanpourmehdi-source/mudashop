import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// پیام‌های چت پشتیبانیِ همین مشتری (آخرین ۱۰۰ پیام) + بازگرداندن بجِ
// نخوانده‌ی ادمین. بعد از واکشی، پیام‌های ادمین به‌عنوان خوانده‌شده علامت می‌خورند
// تا بجِ مشتری صفر شود.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  }

  // نزولی + reverse: قبلاً asc + take:100 بود، یعنی بعد از ۱۰۰ پیام *قدیمی‌ترین* ۱۰۰تا
  // برمی‌گشت و پیام‌های جدید اصلاً دیده نمی‌شدن
  const messages = (
    await prisma.supportMessage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  ).reverse();

  // هر پیامِ ادمین که مشتری الان دیده (پنل باز یا این واکشی) → خوانده‌شده
  const unreadAdminCount = messages.filter((m) => m.sender === "ADMIN" && !m.customerRead).length;
  if (unreadAdminCount > 0) {
    await prisma.supportMessage.updateMany({
      where: { userId: session.user.id, sender: "ADMIN", customerRead: false },
      data: { customerRead: true },
    });
  }

  return NextResponse.json({ messages });
}
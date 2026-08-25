import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishAdminEvent, publishUserEvent } from "@/lib/chatBus";

// ارسال پیام در چت پشتیبانی از سمت مشتری
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "پیام خالی است" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "پیام خیلی طولانی است" }, { status: 400 });
  }

  const created = await prisma.supportMessage.create({
    data: {
      userId: session.user.id,
      sender: "CUSTOMER",
      message,
      adminRead: false,
      customerRead: true,
    },
  });

  const eventPayload = {
    type: "message" as const,
    userId: session.user.id,
    message: { id: created.id, sender: created.sender, message: created.message, createdAt: created.createdAt.toISOString() },
  };
  // پخش زنده به پنل ادمین -- مکالمه همان‌لحظه آپدیت می‌شود
  publishAdminEvent(eventPayload);
  // پخش به استریمِ خودِ مشتری هم لازمه -- ویجت چت پیامِ خودش رو فقط از طریق
  // همین SSE نشون می‌ده (بدون افزودنِ محلی/optimistic)، وگرنه بعد از ارسال
  // چیزی نمایش داده نمی‌شه
  publishUserEvent(session.user.id, eventPayload);

  return NextResponse.json(created);
}
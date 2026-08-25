import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { publishUserEvent } from "@/lib/chatBus";
import { z } from "zod";

// پیام‌های یک مکالمه‌ی خاص برای ادمین. بعد از واکشی، پیام‌های مشتریِ آن کاربر
// به‌عنوان خوانده‌شده علامت می‌خورند (بجِ نخوانده صفر می‌شود).
export async function GET(req: Request) {
  const { ok } = await requireAdmin("SUPPORT");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId لازم است" }, { status: 400 });

  const messages = await prisma.supportMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const unread = messages.filter((m) => m.sender === "CUSTOMER" && !m.adminRead).length;
  if (unread > 0) {
    await prisma.supportMessage.updateMany({
      where: { userId, sender: "CUSTOMER", adminRead: false },
      data: { adminRead: true },
    });
  }

  return NextResponse.json({ messages });
}

// پاسخ ادمین در یک مکالمه
export async function POST(req: Request) {
  const { ok } = await requireAdmin("SUPPORT");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = z
    .object({
      userId: z.string().min(1),
      message: z.string().min(1).max(2000),
    })
    .safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  const created = await prisma.supportMessage.create({
    data: {
      userId: parsed.data.userId,
      sender: "ADMIN",
      message: parsed.data.message.trim(),
      adminRead: true,
      customerRead: false,
    },
  });

  // پخش زنده به مشتری -- پیام همان‌لحظه در چت او ظاهر می‌شود
  publishUserEvent(parsed.data.userId, {
    type: "message",
    userId: parsed.data.userId,
    message: { id: created.id, sender: created.sender, message: created.message, createdAt: created.createdAt.toISOString() },
  });

  return NextResponse.json(created);
}
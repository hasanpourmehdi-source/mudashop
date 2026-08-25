import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// گفت‌وگوی مستقیم مشتری/ادمین درباره‌ی یک سفارش -- هم مشتریِ صاحب سفارش هم
// هر ادمینی می‌تونن بخونن/بنویسن؛ هر پیام جدید طرف مقابل رو نوتیف می‌کنه
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { userId: true } });
  if (!order || (order.userId !== session.user.id && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  const messages = await prisma.orderMessage.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

const schema = z.object({ message: z.string().trim().min(1).max(1000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "لطفاً متن پیام را بنویسید" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, select: { userId: true } });
  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = order.userId === session.user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  // اگه ادمین صاحب همون سفارش هم باشه (نادر)، پیامش به‌عنوان ادمین ثبت می‌شه --
  // چون هدف گفت‌وگو با پشتیبانیه، نه با خودش
  const sender = isAdmin ? "ADMIN" : "CUSTOMER";

  const created = await prisma.orderMessage.create({
    data: { orderId: id, sender, message: parsed.data.message },
  });

  if (sender === "CUSTOMER") {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          message: `پیام جدید از مشتری روی سفارش #${id.slice(-8)}`,
          link: `/admin/orders/${id}`,
        })),
      });
    }
  } else {
    await prisma.notification.create({
      data: {
        userId: order.userId,
        message: `پاسخ جدید از پشتیبانی روی سفارش #${id.slice(-8)}`,
        link: `/orders/${id}`,
      },
    });
    await notifyCustomerOutbound({
      userId: order.userId,
      eventType: "SUPPORT_REPLY",
      title: `پاسخ جدید پشتیبانی روی سفارش #${id.slice(-8)}`,
      body: `پاسخ جدیدی از پشتیبانی روی سفارش #${id.slice(-8)} دریافت شد. آن را در صفحه‌ی سفارش ببینید.`,
    });
  }

  return NextResponse.json(created);
}

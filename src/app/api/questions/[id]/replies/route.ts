import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const replySchema = z.object({
  message: z.string().min(1, "پیام نمی‌تواند خالی باشد").max(500, "پیام خیلی طولانی است"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const question = await prisma.productQuestion.findUnique({ where: { id } });
  if (!question) {
    return NextResponse.json({ error: "سوال پیدا نشد" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOriginalAsker = question.userId === session.user.id;

  // فقط کسی که خودش این سوال رو پرسیده یا ادمین می‌تونه به این گفتگو پیام اضافه کنه
  if (!isAdmin && !isOriginalAsker) {
    return NextResponse.json(
      { error: "فقط پرسنده‌ی اصلی یا پشتیبانی می‌تواند در این گفتگو پیام بدهد" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const reply = await prisma.questionReply.create({
    data: {
      questionId: id,
      userId: session.user.id,
      message: parsed.data.message,
      isAdmin,
    },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json(reply, { status: 201 });
}

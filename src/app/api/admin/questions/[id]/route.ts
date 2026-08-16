import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const answerSchema = z.object({
  answer: z.string().min(1, "پاسخ نمی‌تواند خالی باشد").max(1000, "پاسخ خیلی طولانی است"),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "پاسخ نامعتبر است" }, { status: 400 });
  }

  const question = await prisma.productQuestion.update({
    where: { id },
    data: { answer: parsed.data.answer, answeredAt: new Date() },
  });
  return NextResponse.json(question);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;

  try {
    await prisma.productQuestion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "سوال پیدا نشد" }, { status: 404 });
  }
}

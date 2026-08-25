import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const replySchema = z.object({
  reply: z.string().min(1, "پاسخ را بنویسید").max(1000, "پاسخ خیلی طولانی است"),
});

// ثبت/ویرایش پاسخ تیم مُداشاپ به یک نظر (مثل پاسخ فروشنده روی آمازون).
// با reply خالی، پاسخ قبلی پاک می‌شود.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const review = await prisma.review.findUnique({ where: { id }, select: { id: true } });
  if (!review) return NextResponse.json({ error: "نظر یافت نشد" }, { status: 404 });

  const updated = await prisma.review.update({
    where: { id },
    data: {
      adminReply: parsed.data.reply,
      repliedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
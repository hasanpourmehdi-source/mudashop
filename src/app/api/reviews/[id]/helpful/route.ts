import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// رأی «مفید بود» برای یک نظر -- toggle (کلیک دوباره = پس‌گرفتن رأی).
// خروجی: تعداد رأی جدید + اینکه کاربر فعلی رأی داده یا نه.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, select: { id: true } });
  if (!review) {
    return NextResponse.json({ error: "نظر یافت نشد" }, { status: 404 });
  }

  const existing = await prisma.reviewHelpfulVote.findUnique({
    where: { reviewId_userId: { reviewId: id, userId: session.user.id } },
  });

  if (existing) {
    await prisma.reviewHelpfulVote.delete({ where: { id: existing.id } });
  } else {
    await prisma.reviewHelpfulVote.create({
      data: { reviewId: id, userId: session.user.id },
    });
  }

  const count = await prisma.reviewHelpfulVote.count({ where: { reviewId: id } });
  return NextResponse.json({ helpfulCount: count, votedByMe: !existing });
}
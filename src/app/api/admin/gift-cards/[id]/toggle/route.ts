import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

// فعال/غیرفعال‌کردن کارت هدیه توسط ادمین (غیرفعال‌شده قابل فعال‌سازی نیست؛
// غیرفعال‌کردنِ کارت فعال، از مصرف جلوگیری می‌کنه)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const card = await prisma.giftCard.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "کارت یافت نشد" }, { status: 404 });

  const updated = await prisma.giftCard.update({
    where: { id },
    data: { isActive: !card.isActive },
  });

  return NextResponse.json({ isActive: updated.isActive });
}
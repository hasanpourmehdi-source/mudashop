import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { generateGiftCardCode } from "@/lib/giftCard";
import { z } from "zod";

const createSchema = z.object({
  amount: z.number().int().min(1_000).max(50_000_000),
  message: z.string().max(200).optional().nullable(),
});

// لیست همه‌ی کارت‌های هدیه (جدیدترین اول) + ساخت کارت توسط ادمین (قرعه‌کشی/جایزه)
export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const cards = await prisma.giftCard.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      initialAmount: true,
      balance: true,
      message: true,
      recipientEmail: true,
      buyerUserId: true,
      redeemedByUserId: true,
      isActive: true,
      createdAt: true,
      redeemedAt: true,
      expiresAt: true,
      buyerUser: { select: { name: true, email: true } },
      redeemedByUser: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ cards });
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const card = await prisma.giftCard.create({
    data: {
      code: generateGiftCardCode(),
      initialAmount: parsed.data.amount,
      balance: parsed.data.amount,
      message: parsed.data.message || null,
    },
  });

  return NextResponse.json({ card }, { status: 201 });
}
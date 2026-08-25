import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buyGiftCard } from "@/lib/giftCard";
import { z } from "zod";

const buySchema = z.object({
  amount: z.number().int().min(10_000, "حداقل مبلغ کارت هدیه ۱۰٬۰۰۰ تومان است").max(50_000_000),
  message: z.string().max(200).optional().nullable(),
  recipientEmail: z.string().email("ایمیل نامعتبر است").optional().nullable(),
});

// کارت‌های هدیه‌ای که خریداری کرده‌ام + کارت‌هایی که فعال کرده‌ام
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ bought: [], redeemed: [] });
  }

  const [bought, redeemed] = await Promise.all([
    prisma.giftCard.findMany({
      where: { buyerUserId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        initialAmount: true,
        balance: true,
        message: true,
        recipientEmail: true,
        isActive: true,
        createdAt: true,
        redeemedAt: true,
      },
    }),
    prisma.giftCard.findMany({
      where: { redeemedByUserId: session.user.id },
      orderBy: { redeemedAt: "desc" },
      select: {
        id: true,
        code: true,
        initialAmount: true,
        redeemedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ bought, redeemed });
}

// خرید کارت هدیه با موجودی کیف پول
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = buySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  try {
    const card = await buyGiftCard({
      buyerUserId: session.user.id,
      amount: parsed.data.amount,
      message: parsed.data.message,
      recipientEmail: parsed.data.recipientEmail,
    });
    return NextResponse.json({ card }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "موجودی کیف پول کافی نیست" }, { status: 400 });
  }
}
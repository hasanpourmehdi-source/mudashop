import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const bankCardSchema = z.object({
  cardNumber: z.string().min(1, "شماره کارت الزامی است"),
  shebaNumber: z.string().optional(),
  holderName: z.string().min(1, "نام صاحب حساب الزامی است"),
  label: z.string().optional(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const cards = await prisma.bankCard.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(cards);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = bankCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  // اولین کارِ ثبت‌شده‌ی سیستم خودکار پیش‌فرض می‌شه -- وگرنه تخصیصِ خودکار
  // موقع finalize هیچ پیش‌فرضی پیدا نمی‌کنه
  const isFirstCard = (await prisma.bankCard.count()) === 0;
  const card = await prisma.bankCard.create({
    data: { ...parsed.data, ...(isFirstCard ? { isDefault: true } : {}) },
  });
  return NextResponse.json(card, { status: 201 });
}

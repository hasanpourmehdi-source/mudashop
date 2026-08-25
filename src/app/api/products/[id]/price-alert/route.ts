import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  targetPrice: z.number().int().min(1, "مبلغ باید حداقل ۱ تومان باشد").max(1_000_000_000),
});

// اخطار کاهش قیمت برای یک محصول:
// GET  -> اخطار فعلی کاربر (یا null)
// POST -> ثبت/به‌روزرسانی (upsert) و فعال‌کردن دوباره (re-arm بعد از اطلاع قبلی)
// DELETE -> حذف
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ alert: null });
  }

  const { id } = await params;
  const alert = await prisma.priceAlert.findUnique({
    where: { userId_productId: { userId: session.user.id, productId: id } },
    select: { targetPrice: true, notifiedAt: true },
  });

  return NextResponse.json({ alert });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) {
    return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });
  }

  const alert = await prisma.priceAlert.upsert({
    where: { userId_productId: { userId: session.user.id, productId: id } },
    create: { userId: session.user.id, productId: id, targetPrice: parsed.data.targetPrice },
    // re-arm: وقتی قبلاً اطلاع داده شده و حالا دوباره ثبت می‌کنیم، فعال می‌شود
    update: { targetPrice: parsed.data.targetPrice, notifiedAt: null },
    select: { targetPrice: true, notifiedAt: true },
  });

  return NextResponse.json({ alert });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.priceAlert.deleteMany({
    where: { userId: session.user.id, productId: id },
  });

  return NextResponse.json({ ok: true });
}
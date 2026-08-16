import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { invalidateExchangeRateCache } from "@/lib/exchangeRate";
import { z } from "zod";

const updateSchema = z.object({
  currencyLabel: z.string().trim().min(1, "نام فارسی ارز الزامی است"),
  rate: z.number().positive("نرخ باید بزرگ‌تر از صفر باشد"),
  profitPercent: z.number().min(0, "درصد سود نمی‌تواند منفی باشد"),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const rate = await prisma.exchangeRate.update({ where: { id }, data: parsed.data });
  invalidateExchangeRateCache(rate.currency);
  return NextResponse.json(rate);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const rate = await prisma.exchangeRate.delete({ where: { id } });
  invalidateExchangeRateCache(rate.currency);
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { invalidateExchangeRateCache } from "@/lib/exchangeRate";
import { z } from "zod";

const exchangeRateSchema = z.object({
  currency: z
    .string()
    .trim()
    .min(1, "کد ارز الزامی است")
    .transform((v) => v.toUpperCase()),
  currencyLabel: z.string().trim().min(1, "نام فارسی ارز الزامی است"),
  rate: z.number().positive("نرخ باید بزرگ‌تر از صفر باشد"),
  profitPercent: z.number().min(0, "درصد سود نمی‌تواند منفی باشد"),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const rates = await prisma.exchangeRate.findMany({ orderBy: { currency: "asc" } });
  return NextResponse.json(rates);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = exchangeRateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  try {
    const rate = await prisma.exchangeRate.create({ data: parsed.data });
    invalidateExchangeRateCache(rate.currency);
    return NextResponse.json(rate, { status: 201 });
  } catch {
    return NextResponse.json({ error: "نرخ این ارز قبلاً ثبت شده -- ویرایشش کن" }, { status: 409 });
  }
}

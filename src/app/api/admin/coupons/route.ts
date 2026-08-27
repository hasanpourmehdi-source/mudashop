import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const couponSchema = z.object({
  code: z.string().min(3, "کد تخفیف باید حداقل ۳ حرف باشد"),
  type: z.enum(["PERCENT", "FIXED", "FREE_SHIP", "FIRST_BUY"]),
  value: z.number().int().min(0, "مقدار نمی‌تواند منفی باشد").default(0),
  minOrderAmount: z.number().int().min(0, "حداقل مبلغ سفارش نمی‌تواند منفی باشد").default(0),
  maxUses: z.number().int().positive("حداکثر تعداد استفاده باید مثبت باشد").nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  showcaseOnProducts: z.boolean().optional(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(coupons);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = couponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { expiresAt, ...rest } = parsed.data;
  try {
    const coupon = await prisma.coupon.create({
      data: {
        ...rest,
        code: rest.code.trim().toUpperCase(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch {
    return NextResponse.json({ error: "این کد تخفیف قبلاً وجود دارد" }, { status: 409 });
  }
}

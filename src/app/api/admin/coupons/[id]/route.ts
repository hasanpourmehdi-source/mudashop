import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const updateSchema = z.object({
  code: z.string().min(3, "کد تخفیف باید حداقل ۳ حرف باشد").optional(),
  type: z.enum(["PERCENT", "FIXED", "FREE_SHIP", "FIRST_BUY"]).optional(),
  value: z.number().int().min(0, "مقدار نمی‌تواند منفی باشد").optional(),
  minOrderAmount: z.number().int().min(0, "حداقل مبلغ سفارش نمی‌تواند منفی باشد").optional(),
  maxUses: z.number().int().positive("حداکثر تعداد استفاده باید مثبت باشد").nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  showcaseOnProducts: z.boolean().optional(),
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

  const { code, expiresAt, ...rest } = parsed.data;

  try {
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...rest,
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      },
    });
    return NextResponse.json(coupon);
  } catch {
    return NextResponse.json({ error: "این کد تخفیف قبلاً وجود دارد" }, { status: 409 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

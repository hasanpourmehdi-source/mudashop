import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const updateSchema = z.object({
  cardNumber: z.string().min(1, "شماره کارت الزامی است").optional(),
  shebaNumber: z.string().optional(),
  holderName: z.string().min(1, "نام صاحب حساب الزامی است").optional(),
  label: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
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
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  // فقط یه کارت می‌تونه پیش‌فرض باشه -- وقتی یکی رو پیش‌فرض می‌کنیم، بقیه خودکار برداشته می‌شن
  const card = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.bankCard.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    const updated = await tx.bankCard.update({ where: { id }, data: parsed.data });
    // غیرفعال‌کردنِ کارتِ پیش‌فرض نباید سیستم رو بدون پیش‌فرض بذاره -- وگرنه
    // finalizeItemsPayment مسیرِ fallback دلخواه/تصادفی کارت تخصیص می‌ده
    if (updated.isDefault && !updated.isActive) {
      await tx.bankCard.update({ where: { id }, data: { isDefault: false } });
      await promoteOldestActiveAsDefault(tx);
    }
    return updated.isDefault && !updated.isActive ? { ...updated, isDefault: false } : updated;
  });
  return NextResponse.json(card);
}

// ارتقای قدیمی‌ترین کارت فعال به پیش‌فرض -- بعد از حذف/غیرفعال‌شدنِ پیش‌فرض
async function promoteOldestActiveAsDefault(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  const next = await tx.bankCard.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (next) {
    await tx.bankCard.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.bankCard.delete({ where: { id } });
    // اگه کارتِ حذف‌شده پیش‌فرض بود، قدیمی‌ترین کارتِ فعال جایگزین می‌شه --
    // بدون این، تخصیصِ خودکار کارت به سفارش جدید نامعلوم/تصادفی می‌شه
    if (deleted.isDefault) {
      await promoteOldestActiveAsDefault(tx);
    }
  });
  return NextResponse.json({ success: true });
}

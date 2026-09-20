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
  isDefaultForCargo: z.boolean().optional(),
  isDefaultForShipping: z.boolean().optional(),
});

// هر سه فلگِ پیش‌فرض (سفارش/باربری/ارسال) کاملاً مستقلن -- روشن‌کردنِ یکی روی
// یه کارت فقط بقیه‌ی کارت‌های *همون* فلگ رو خاموش می‌کنه، نه فلگ‌های دیگه
const DEFAULT_FLAGS = ["isDefault", "isDefaultForCargo", "isDefaultForShipping"] as const;

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

  // فقط یه کارت می‌تونه پیش‌فرضِ هر هدف باشه -- وقتی یکی رو پیش‌فرض می‌کنیم، بقیه‌ی همون هدف خودکار برداشته می‌شن
  const card = await prisma.$transaction(async (tx) => {
    for (const flag of DEFAULT_FLAGS) {
      if (parsed.data[flag]) {
        await tx.bankCard.updateMany({ where: { [flag]: true, id: { not: id } }, data: { [flag]: false } });
      }
    }
    let updated = await tx.bankCard.update({ where: { id }, data: parsed.data });
    // غیرفعال‌کردنِ کارتِ پیش‌فرض نباید سیستم رو بدون پیش‌فرض بذاره -- وگرنه
    // مسیرهای تخصیصِ خودکارِ کارت (finalizeItemsPayment و امثالش) بدونِ پیش‌فرض می‌مونن
    if (!updated.isActive && (updated.isDefault || updated.isDefaultForCargo || updated.isDefaultForShipping)) {
      const clearedFlags: Record<string, boolean> = {};
      for (const flag of DEFAULT_FLAGS) {
        if (updated[flag]) clearedFlags[flag] = false;
      }
      updated = await tx.bankCard.update({ where: { id }, data: clearedFlags });
      for (const flag of DEFAULT_FLAGS) {
        if (clearedFlags[flag] === false) await promoteOldestActiveAsDefault(tx, flag);
      }
    }
    return updated;
  });
  return NextResponse.json(card);
}

// ارتقای قدیمی‌ترین کارت فعال به پیش‌فرضِ فلگِ مشخص‌شده -- بعد از حذف/غیرفعال‌شدنِ پیش‌فرض
async function promoteOldestActiveAsDefault(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  flag: (typeof DEFAULT_FLAGS)[number] = "isDefault"
) {
  const next = await tx.bankCard.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (next) {
    await tx.bankCard.update({ where: { id: next.id }, data: { [flag]: true } });
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
    // اگه کارتِ حذف‌شده پیش‌فرضِ یکی از سه هدف بود، قدیمی‌ترین کارتِ فعال
    // جایگزینِ همون هدف می‌شه -- بدون این، تخصیصِ خودکارِ کارت نامعلوم می‌شه
    for (const flag of DEFAULT_FLAGS) {
      if (deleted[flag]) await promoteOldestActiveAsDefault(tx, flag);
    }
  });
  return NextResponse.json({ success: true });
}

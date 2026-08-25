import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const schema = z.object({
  itemId: z.string(),
  weightGrams: z.number().int().positive(),
});

// افزودنِ یک قلمِ خریداری‌شده به محموله -- وزنش هم همین‌جا ثبت می‌شه (لازم برای
// تقسیمِ هزینه‌ی باربری بر اساس وزن)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) return NextResponse.json({ error: "محموله یافت نشد" }, { status: 404 });
  if (shipment.shippedAt) {
    return NextResponse.json({ error: "این محموله نهایی شده و قابل تغییر نیست" }, { status: 400 });
  }

  const item = await prisma.orderItem.findUnique({ where: { id: parsed.data.itemId } });
  if (!item || item.purchaseStatus !== "PURCHASED" || item.shipmentId) {
    return NextResponse.json({ error: "این قلم قابل افزودن به محموله نیست" }, { status: 400 });
  }

  await prisma.orderItem.update({
    where: { id: parsed.data.itemId },
    data: { shipmentId: id, itemWeightGrams: parsed.data.weightGrams },
  });

  return NextResponse.json({ success: true });
}

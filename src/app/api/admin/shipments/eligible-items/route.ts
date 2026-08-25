import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

// اقلامِ خارجیِ «خریداری‌شده» که هنوز به هیچ محموله‌ای اضافه نشدن -- کاندیدهای
// تجمیع در یک محمولهٔ مشترک
export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const items = await prisma.orderItem.findMany({
    where: { source: "TRENDYOL", purchaseStatus: "PURCHASED", shipmentId: null },
    select: {
      id: true,
      title: true,
      quantity: true,
      purchaseTag: true,
      itemWeightGrams: true,
      orderId: true,
      order: { select: { id: true, user: { select: { name: true, email: true } } } },
    },
    orderBy: { purchaseResolvedAt: "desc" },
  });
  return NextResponse.json(items);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { ok } = await requireAdmin("PRODUCTS");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id, itemId } = await params;
  const item = await prisma.occasionCollectionItem.findUnique({ where: { id: itemId } });
  if (!item || item.collectionId !== id) {
    return NextResponse.json({ error: "آیتم یافت نشد" }, { status: 404 });
  }

  await prisma.occasionCollectionItem.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}

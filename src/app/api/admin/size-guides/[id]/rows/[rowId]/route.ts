import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function DELETE(_req: Request, { params }: { params: Promise<{ rowId: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { rowId } = await params;
  await prisma.sizeChartRow.delete({ where: { id: rowId } });
  return NextResponse.json({ success: true });
}

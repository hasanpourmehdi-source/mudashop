import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ردیف‌های عددیِ (قد/وزن) یک راهنمای سایز -- عمومی/بدون لاگین (برای ویجتِ
// «پیشنهاد سایز بر اساس قد و وزن» توی صفحه‌ی محصول)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await prisma.sizeChartRow.findMany({
    where: { sizeGuideId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(rows);
}

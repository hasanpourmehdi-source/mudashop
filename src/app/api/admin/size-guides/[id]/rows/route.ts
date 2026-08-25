import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

// ردیفِ عددیِ یک سایز (قد/وزن) -- برای پیشنهادِ خودکارِ سایز از روی قد/وزنِ
// مشتری، علاوه‌بر عکسِ جدولِ راهنمای سایز
const rowSchema = z.object({
  sizeLabel: z.string().min(1, "برچسب سایز الزامی است"),
  minHeightCm: z.number().int().positive().optional().nullable(),
  maxHeightCm: z.number().int().positive().optional().nullable(),
  minWeightKg: z.number().int().positive().optional().nullable(),
  maxWeightKg: z.number().int().positive().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = rowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const row = await prisma.sizeChartRow.create({
    data: { sizeGuideId: id, ...parsed.data },
  });
  return NextResponse.json(row, { status: 201 });
}

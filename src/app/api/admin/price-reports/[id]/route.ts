import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  adminNote: z.string().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin("SUPPORT");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  try {
    const report = await prisma.cheaperPriceReport.update({
      where: { id },
      data: {
        status: parsed.data.status,
        adminNote: parsed.data.adminNote || null,
        resolvedAt: new Date(),
      },
    });
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "گزارش پیدا نشد" }, { status: 404 });
  }
}

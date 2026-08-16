import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const questions = await prisma.productQuestion.findMany({
    include: {
      product: { select: { title: true, slug: true } },
      replies: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ answeredAt: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(questions);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const groupSchema = z.object({
  name: z.string().min(1, "نام گروه الزامی است"),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const groups = await prisma.attributeGroup.findMany({
    include: { attributes: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = groupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  try {
    const group = await prisma.attributeGroup.create({ data: parsed.data });
    return NextResponse.json(group, { status: 201 });
  } catch {
    return NextResponse.json({ error: "این گروه قبلاً وجود دارد" }, { status: 409 });
  }
}

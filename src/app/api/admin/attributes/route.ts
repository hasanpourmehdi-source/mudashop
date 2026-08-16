import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const attributeSchema = z.object({
  name: z.string().min(1, "نام ویژگی الزامی است"),
  values: z.array(z.string().min(1)).min(1, "حداقل یک مقدار لازم است"),
  groupId: z.string().nullable().optional(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const attributes = await prisma.attribute.findMany({
    include: {
      values: { orderBy: { order: "asc" } },
      categories: { include: { category: true } },
      group: true,
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(attributes);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = attributeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const uniqueValues = Array.from(new Set(parsed.data.values.map((v) => v.trim()).filter(Boolean)));

  try {
    const attribute = await prisma.attribute.create({
      data: {
        name: parsed.data.name,
        groupId: parsed.data.groupId || null,
        // ترتیبی که ادمین وارد کرده (index آرایه) دقیقاً همون ترتیب نمایشه
        values: { create: uniqueValues.map((value, order) => ({ value, order })) },
      },
      include: { values: { orderBy: { order: "asc" } }, group: true },
    });
    return NextResponse.json(attribute, { status: 201 });
  } catch {
    return NextResponse.json({ error: "این ویژگی قبلاً وجود دارد" }, { status: 409 });
  }
}

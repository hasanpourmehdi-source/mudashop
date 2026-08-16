import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  baseUrl: z
    .string()
    .url()
    .refine((v) => v.includes("?"), { message: "لینک پایه باید با ? تمام شود" })
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const site = await prisma.externalSite.update({ where: { id }, data: parsed.data });
  return NextResponse.json(site);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  await prisma.externalSite.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

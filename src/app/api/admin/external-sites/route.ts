import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const siteSchema = z.object({
  name: z.string().min(1, "نام سایت الزامی است"),
  slug: z
    .string()
    .min(1, "شناسه (slug) الزامی است")
    .regex(/^[a-z0-9-]+$/, "شناسه فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد"),
  baseUrl: z
    .string()
    .url("لینک پایه معتبر نیست")
    .refine((v) => v.includes("?"), { message: "لینک پایه باید با ? تمام شود (مثلاً .../sr?)" }),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const sites = await prisma.externalSite.findMany({
    include: {
      categoryParams: { include: { category: { select: { id: true, name: true, slug: true } } } },
      attributeParams: { include: { attribute: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(sites);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = siteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  try {
    const site = await prisma.externalSite.create({ data: parsed.data });
    return NextResponse.json(site, { status: 201 });
  } catch {
    return NextResponse.json({ error: "این شناسه (slug) قبلاً استفاده شده" }, { status: 409 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { SITE_SETTING_KEYS, getSiteSettings } from "@/lib/siteSettings";
import { z } from "zod";

const schema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const settings = await getSiteSettings(Object.values(SITE_SETTING_KEYS));
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const { key, value } = parsed.data;
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });

  return NextResponse.json({ success: true });
}

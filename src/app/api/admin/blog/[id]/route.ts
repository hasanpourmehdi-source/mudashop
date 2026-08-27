import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { normalizeSlug } from "@/lib/slug";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(2, "عنوان باید حداقل ۲ حرف باشد").optional(),
  slug: z.string().min(2, "اسلاگ باید حداقل ۲ حرف باشد").optional(),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  body: z.string().min(10, "متن پست باید حداقل ۱۰ حرف باشد").optional(),
  isPublished: z.boolean().optional(),
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

  const { slug, isPublished, ...rest } = parsed.data;

  // اگه تازه منتشر می‌شه (قبلاً منتشر نبوده)، تاریخ انتشار همین الان ثبت بشه --
  // اگه قبلاً هم منتشر بوده، تاریخِ اصلیِ انتشار دست‌نخورده می‌مونه
  let publishedAtUpdate: { publishedAt?: Date | null } = {};
  if (isPublished !== undefined) {
    if (isPublished) {
      const existing = await prisma.blogPost.findUnique({ where: { id }, select: { publishedAt: true } });
      publishedAtUpdate = { publishedAt: existing?.publishedAt ?? new Date() };
    } else {
      publishedAtUpdate = {};
    }
  }

  try {
    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...rest,
        ...(slug ? { slug: normalizeSlug(slug) } : {}),
        ...(isPublished !== undefined ? { isPublished } : {}),
        ...publishedAtUpdate,
      },
    });
    return NextResponse.json(post);
  } catch {
    return NextResponse.json({ error: "این اسلاگ قبلاً استفاده شده" }, { status: 409 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  await prisma.blogPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

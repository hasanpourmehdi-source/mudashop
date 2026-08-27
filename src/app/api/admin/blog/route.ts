import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { normalizeSlug } from "@/lib/slug";
import { z } from "zod";

const postSchema = z.object({
  title: z.string().min(2, "عنوان باید حداقل ۲ حرف باشد"),
  slug: z.string().min(2, "اسلاگ باید حداقل ۲ حرف باشد"),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  body: z.string().min(10, "متن پست باید حداقل ۱۰ حرف باشد"),
  isPublished: z.boolean().optional().default(false),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const { isPublished, ...rest } = parsed.data;
  try {
    const post = await prisma.blogPost.create({
      data: {
        ...rest,
        slug: normalizeSlug(rest.slug),
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
    });
    return NextResponse.json(post, { status: 201 });
  } catch {
    return NextResponse.json({ error: "این اسلاگ قبلاً استفاده شده" }, { status: 409 });
  }
}

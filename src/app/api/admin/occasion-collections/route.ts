import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const occasionCollectionSchema = z.object({
  title: z.string().min(1, "عنوان مجموعه الزامی است"),
  slug: z
    .string()
    .min(1, "نامک (slug) الزامی است")
    .regex(/^[a-z0-9-]+$/, "نامک فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد"),
  bannerImage: z.string().url("آدرس تصویر بنر معتبر نیست"),
  description: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function GET() {
  const { ok } = await requireAdmin("PRODUCTS");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const collections = await prisma.occasionCollection.findMany({
    include: { items: { orderBy: { addedAt: "asc" } } },
    orderBy: { startsAt: "desc" },
  });
  return NextResponse.json(collections);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin("PRODUCTS");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = occasionCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const { startsAt, endsAt, ...rest } = parsed.data;
  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: "زمان پایان باید بعد از زمان شروع باشد" }, { status: 400 });
  }

  const existing = await prisma.occasionCollection.findUnique({ where: { slug: rest.slug } });
  if (existing) {
    return NextResponse.json({ error: "این نامک قبلاً استفاده شده است" }, { status: 400 });
  }

  const collection = await prisma.occasionCollection.create({
    data: { ...rest, startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
  });
  return NextResponse.json(collection, { status: 201 });
}

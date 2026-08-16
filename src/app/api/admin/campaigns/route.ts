import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const campaignSchema = z.object({
  title: z.string().min(1, "عنوان کمپین الزامی است"),
  slug: z
    .string()
    .min(1, "نامک (slug) الزامی است")
    .regex(/^[a-z0-9-]+$/, "نامک فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد"),
  brandId: z.string().min(1, "انتخاب برند الزامی است"),
  bannerImage: z.string().url("آدرس تصویر بنر معتبر نیست"),
  description: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const campaigns = await prisma.campaign.findMany({
    include: { brand: { select: { name: true } } },
    orderBy: { startsAt: "desc" },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = campaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { startsAt, endsAt, ...rest } = parsed.data;
  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json(
      { error: "زمان پایان باید بعد از زمان شروع باشد" },
      { status: 400 }
    );
  }

  const existing = await prisma.campaign.findUnique({ where: { slug: rest.slug } });
  if (existing) {
    return NextResponse.json({ error: "این نامک قبلاً استفاده شده است" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: { ...rest, startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
  });
  return NextResponse.json(campaign, { status: 201 });
}

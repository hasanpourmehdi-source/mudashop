import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  contentIds: z.array(z.string().min(1)).max(200),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ urlMap: {} }, { status: 400 });
    }

    const { contentIds } = parsed.data;
    if (contentIds.length === 0) {
      return NextResponse.json({ urlMap: {} });
    }

    const rows = await prisma.trendyolProductUrlCache.findMany({
      where: { contentId: { in: contentIds } },
      select: { contentId: true, url: true },
    });
    const urlMap = rows.reduce((acc, { contentId, url }) => {
      acc[contentId] = url;
      return acc;
    }, {} as Record<string, string>);
    return NextResponse.json({ urlMap });
  } catch (err) {
    console.error("Error fetching cart product URLs:", err);
    return NextResponse.json({ urlMap: {} }, { status: 500 });
  }
}
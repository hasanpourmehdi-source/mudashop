import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// عکسِ لحظه‌ایِ «اخیراً دیده‌اید»ِ کاربرِ لاگین‌کرده رو با سرور sync می‌کنه --
// تا با لاگین از یه دستگاه/مرورگرِ دیگه، همون لیست دوباره قابل‌بازیابی باشه
// (خودِ localStorage فقط مالِ همون مرورگره). کلاینت این رو با debounce، هر بار
// که لیست عوض می‌شه صدا می‌زنه (src/components/RecentlyViewedUserSync.tsx)
const recentlyViewedItemSchema = z.object({
  id: z.string(),
  source: z.enum(["MAZON", "TRENDYOL"]),
  slugOrId: z.string(),
  title: z.string(),
  image: z.string(),
  price: z.number(),
  originalPrice: z.number(),
  discount: z.number(),
  href: z.string(),
  viewedAt: z.string(),
});

const syncSchema = z.object({
  items: z.array(recentlyViewedItemSchema),
});

function parseItems(json: string): z.infer<typeof recentlyViewedItemSchema>[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const result: z.infer<typeof recentlyViewedItemSchema>[] = [];
  for (const entry of raw) {
    const parsed = recentlyViewedItemSchema.safeParse(entry);
    if (parsed.success) result.push(parsed.data);
  }
  return result;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const snap = await prisma.recentlyViewedSnapshot.findUnique({ where: { userId: session.user.id } });
  if (!snap) {
    return NextResponse.json({ items: [] });
  }

  return NextResponse.json({ items: parseItems(snap.itemsJson) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const { items } = parsed.data;
  const itemsJson = JSON.stringify(items);

  if (items.length === 0) {
    await prisma.recentlyViewedSnapshot.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ ok: true });
  }

  await prisma.recentlyViewedSnapshot.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, itemsJson },
    update: { itemsJson },
  });

  return NextResponse.json({ ok: true });
}

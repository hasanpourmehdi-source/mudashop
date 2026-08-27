import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// عکسِ لحظه‌ایِ سبد خرید کاربر لاگین‌کرده رو با سرور sync می‌کنه -- هم برای
// یادآوریِ سبدِ رهاشده (src/lib/abandonedCart.ts) هم برای این‌که با لاگین از
// یه دستگاه دیگه، سبد و «خرید بعدی» دوباره قابل‌بازیابی باشن. کلاینت این رو
// با debounce، هر بار که سبد عوض می‌شه صدا می‌زنه (src/components/CartUserSync.tsx)
const cartItemSchema = z.object({
  id: z.string(),
  source: z.enum(["MAZON", "TRENDYOL"]),
  productId: z.string(),
  variantId: z.string().optional(),
  flashSaleId: z.string().optional(),
  title: z.string(),
  image: z.string(),
  price: z.number(),
  originalPrice: z.number().optional(),
  quantity: z.number().int().positive(),
  variantLabel: z.string().optional(),
  maxStock: z.number().optional(),
  fastShipping: z.boolean().optional(),
  siteLabel: z.string().optional(),
});

const syncSchema = z.object({
  items: z.array(cartItemSchema),
  savedForLater: z.array(cartItemSchema).default([]),
});

// فقط اقلامی که واقعاً شکل کاملِ CartItem رو دارن نگه می‌داره -- ردیف‌های
// قدیمی (قبل از این فیچر) شکلِ کوچیک‌تری داشتن و نباید باعث خطا بشن
function parseCartItems(json: string): z.infer<typeof cartItemSchema>[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const result: z.infer<typeof cartItemSchema>[] = [];
  for (const entry of raw) {
    const parsed = cartItemSchema.safeParse(entry);
    if (parsed.success) result.push(parsed.data);
  }
  return result;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const snap = await prisma.cartSnapshot.findUnique({ where: { userId: session.user.id } });
  if (!snap) {
    return NextResponse.json({ items: [], savedForLater: [] });
  }

  return NextResponse.json({
    items: parseCartItems(snap.itemsJson),
    savedForLater: parseCartItems(snap.savedForLaterJson),
  });
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

  const { items, savedForLater } = parsed.data;
  const itemsJson = JSON.stringify(items);
  const savedForLaterJson = JSON.stringify(savedForLater);

  if (items.length === 0 && savedForLater.length === 0) {
    await prisma.cartSnapshot.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ ok: true });
  }

  // payload دقیقاً مثل قبلیه => هیچ تعاملی با سبد نبوده؛ reminderStage رو صفر
  // نکن وگرنه زنجیره‌ی یادآوریِ سبدِ رهاشده (۲۴/۷۲/۱۶۸ ساعت) برای کاربری که
  // فقط صفحه رو باز کرده هیچ‌وقت جلو نمی‌ره. کلاینت هم خودش duplicate ها رو
  // فیلتر می‌کنه -- این دوباره‌کارِ سمت سروره (مثلاً تب دوم)
  const existing = await prisma.cartSnapshot.findUnique({
    where: { userId: session.user.id },
    select: { itemsJson: true, savedForLaterJson: true },
  });
  if (existing && existing.itemsJson === itemsJson && existing.savedForLaterJson === savedForLaterJson) {
    return NextResponse.json({ ok: true });
  }

  await prisma.cartSnapshot.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      itemsJson,
      savedForLaterJson,
    },
    update: {
      itemsJson,
      savedForLaterJson,
      reminderStage: 0,
    },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// عکسِ لحظه‌ایِ سبد خرید کاربر لاگین‌کرده رو با سرور sync می‌کنه -- فقط برای
// یادآوریِ سبدِ رهاشده لازمه (src/lib/abandonedCart.ts). کلاینت این رو با
// debounce، هر بار که سبد عوض می‌شه صدا می‌زنه (src/components/CartUserSync.tsx)
const syncSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      quantity: z.number().int().positive(),
    })
  ),
});

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

  if (items.length === 0) {
    await prisma.cartSnapshot.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ ok: true });
  }

  await prisma.cartSnapshot.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, itemsJson: JSON.stringify(items) },
    update: { itemsJson: JSON.stringify(items), remindedAt: null },
  });

  return NextResponse.json({ ok: true });
}

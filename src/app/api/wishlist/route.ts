import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const items = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { product: { include: { category: true } } },
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const source = body.source === "TRENDYOL" ? "TRENDYOL" : "MAZON";

  if (source === "MAZON") {
    const { productId } = body;
    if (!productId) {
      return NextResponse.json({ error: "productId لازم است" }, { status: 400 });
    }

    // IDOR-safe: هر کاربر فقط می‌تونه wishlist خودش رو ببینه/تغییر بده چون از session.user.id استفاده می‌کنیم
    const existing = await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      return NextResponse.json({ added: false });
    }

    await prisma.wishlistItem.create({
      data: { userId, productId, source: "MAZON" },
    });
    return NextResponse.json({ added: true });
  }

  // ================= ترندیول (externalId + snapshot) =================
  const { externalId, title, image, url, price } = body;
  if (!externalId) {
    return NextResponse.json({ error: "externalId لازم است" }, { status: 400 });
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_externalId: { userId, externalId } },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ added: false });
  }

  await prisma.wishlistItem.create({
    data: {
      userId,
      source: "TRENDYOL",
      externalId,
      externalTitle: typeof title === "string" ? title : null,
      externalImage: typeof image === "string" ? image : null,
      externalUrl: typeof url === "string" ? url : null,
      externalPrice: typeof price === "number" ? price : null,
    },
  });
  return NextResponse.json({ added: true });
}

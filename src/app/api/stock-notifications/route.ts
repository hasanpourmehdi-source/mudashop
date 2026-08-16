import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  productId: z.string().min(1),
  description: z.string().min(1).max(100),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ descriptions: [] });
  }

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "productId لازم است" }, { status: 400 });
  }

  const rows = await prisma.stockNotification.findMany({
    where: { productId, userId: session.user.id },
    select: { description: true },
  });

  return NextResponse.json({ descriptions: rows.map((r) => r.description) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const { productId, description } = parsed.data;

  await prisma.stockNotification.upsert({
    where: {
      userId_productId_description: {
        userId: session.user.id,
        productId,
        description,
      },
    },
    create: { userId: session.user.id, productId, description },
    update: {},
  });

  return NextResponse.json({ success: true });
}

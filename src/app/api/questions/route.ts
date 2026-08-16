import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const questionSchema = z
  .object({
    productId: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    question: z.string().min(5, "سوال باید حداقل ۵ حرف باشد").max(500, "سوال خیلی طولانی است"),
  })
  .refine((data) => Boolean(data.productId) !== Boolean(data.externalId), {
    message: "دقیقاً یکی از productId یا externalId باید مشخص باشد",
  });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const externalId = searchParams.get("externalId");
  if (!productId && !externalId) {
    return NextResponse.json({ error: "productId یا externalId لازم است" }, { status: 400 });
  }

  const questions = await prisma.productQuestion.findMany({
    where: productId ? { productId } : { externalId, source: "TRENDYOL" },
    include: {
      replies: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(questions);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { productId, externalId, question } = parsed.data;

  const created = await prisma.productQuestion.create({
    data: {
      source: productId ? "MAZON" : "TRENDYOL",
      productId: productId ?? null,
      externalId: externalId ?? null,
      question,
      userId: session.user.id,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

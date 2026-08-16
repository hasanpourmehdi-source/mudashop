import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const reviewSchema = z
  .object({
    productId: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    rating: z.number().int().min(1, "امتیاز باید حداقل ۱ باشد").max(5, "امتیاز نمی‌تواند بیشتر از ۵ باشد"),
    comment: z.string().min(3, "نظر باید حداقل ۳ حرف باشد").max(1000, "نظر خیلی طولانی است"),
    images: z
      .array(z.string().min(1))
      .max(4, "حداکثر ۴ عکس می‌توانید ضمیمه کنید")
      .optional()
      .default([]),
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

  const session = await auth();

  // فقط نظرات تاییدشده عمومی نشون داده می‌شن -- به‌جز خود کاربر که نظر در انتظار تاییدِ خودشو هم می‌بینه
  const reviews = await prisma.review.findMany({
    where: {
      ...(productId ? { productId } : { externalId, source: "TRENDYOL" }),
      OR: [{ isApproved: true }, ...(session?.user?.id ? [{ userId: session.user.id }] : [])],
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const approvedOnly = reviews.filter((r) => r.isApproved);
  const avgRating =
    approvedOnly.length > 0
      ? approvedOnly.reduce((sum, r) => sum + r.rating, 0) / approvedOnly.length
      : 0;

  return NextResponse.json({ reviews, avgRating, count: approvedOnly.length });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { productId, externalId, rating, comment, images } = parsed.data;
  const source = productId ? "MAZON" : "TRENDYOL";

  // بررسی می‌کنیم آیا این کاربر واقعاً این محصول رو خریده (برای برچسب "خرید تأییدشده")
  const hasPurchased = await prisma.orderItem.findFirst({
    where: {
      ...(productId ? { productId } : { externalId, source: "TRENDYOL" }),
      order: { userId: session.user.id, status: { not: "CANCELLED" } },
    },
  });

  try {
    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        source,
        productId: productId ?? null,
        externalId: externalId ?? null,
        rating,
        comment,
        images: JSON.stringify(images),
        verifiedPurchase: Boolean(hasPurchased),
        isApproved: false, // تا وقتی ادمین تاییدش نکنه، عمومی نمایش داده نمی‌شه
      },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        // نقض یکتایی (userId+productId یا userId+externalId) -- واقعاً قبلاً نظر داده
        return NextResponse.json(
          { error: "شما قبلاً برای این محصول نظر ثبت کرده‌اید" },
          { status: 409 }
        );
      }
      if (err.code === "P2003") {
        // نقض کلید خارجی -- یعنی userId توی سشن دیگه توی جدول کاربران وجود نداره
        // (مثلا دیتابیس ری‌ست/سید شده ولی کاربر با سشن قدیمی لاگین مونده)
        return NextResponse.json(
          { error: "حساب کاربری شما دیگر معتبر نیست. لطفاً خارج شوید و دوباره وارد شوید." },
          { status: 401 }
        );
      }
    }
    return NextResponse.json({ error: "خطا در ثبت نظر" }, { status: 500 });
  }
}

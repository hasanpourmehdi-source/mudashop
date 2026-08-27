import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { rateLimitOrNull, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

const reviewSchema = z
  .object({
    productId: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    // فقط وقتی از دکمه‌ی «نظر بده» زیرِ یه قلمِ سفارشِ مشخص میاد پر می‌شه --
    // فرمِ عمومیِ صفحه‌ی محصول این رو نمی‌فرسته
    orderItemId: z.string().min(1).optional(),
    // ترندیول/میلا زیرِ یه source مشترک‌ان -- بدونش externalId ممکنه بینِ دو
    // سایت تصادفاً برخورد کنه. فقط برای مسیرِ عمومی (بدونِ orderItemId) از
    // کلاینت خونده می‌شه؛ برای خریدِ تأییدشده از خودِ OrderItem می‌آد
    externalSiteId: z.string().min(1).optional(),
    // برای دیوارِ ویدیوی صفحه‌ی اصلی -- فقط نمایشیه (نه منبعِ واقعیِ قیمت/عنوان)،
    // چون برای اقلامِ ترندیول محصولِ محلی نداریم که ازش title/image بگیریم
    productTitle: z.string().min(1).optional(),
    // فقط عکسِ آپلودِ داخلی یا یه URLِ https واقعی (مثلاً cdn خودِ ترندیول/میلا)
    // مجازه -- نه data:/javascript: و نه رشته‌ی دلخواه
    productImage: z
      .string()
      .min(1)
      .refine((v) => v.startsWith("/uploads/") || /^https:\/\//.test(v), {
        message: "آدرس عکس محصول نامعتبر است",
      })
      .optional(),
    rating: z.number().int().min(1, "امتیاز باید حداقل ۱ باشد").max(5, "امتیاز نمی‌تواند بیشتر از ۵ باشد"),
    comment: z.string().min(3, "نظر باید حداقل ۳ حرف باشد").max(1000, "نظر خیلی طولانی است"),
    images: z
      .array(z.string().min(1).regex(/^\/uploads\/reviews\//, "عکس‌ها باید از آپلودِ داخلی باشند"))
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
  // ترندیول/میلا زیرِ یه source مشترک‌ان -- اگه صفحه‌ی محصول سایتش رو می‌دونه
  // (جدیدتر از این فیلد)، فقط نظراتِ همون سایت یا نظراتِ قدیمی‌ترِ بدونِ siteId
  // (هنوز مبهم، ولی نباید ناپدید بشن) رو نشون بده -- نه هر externalId مشابه
  // از سایتِ دیگه
  const externalSiteId = searchParams.get("externalSiteId");
  if (!productId && !externalId) {
    return NextResponse.json({ error: "productId یا externalId لازم است" }, { status: 400 });
  }

  const session = await auth();

  // فقط نظرات تاییدشده عمومی نشون داده می‌شن -- به‌جز خود کاربر که نظر در انتظار تاییدِ خودشو هم می‌بینه
  const reviews = await prisma.review.findMany({
    where: {
      ...(productId ? { productId } : { externalId, source: "TRENDYOL" }),
      AND: [
        { OR: [{ isApproved: true }, ...(session?.user?.id ? [{ userId: session.user.id }] : [])] },
        ...(externalSiteId ? [{ OR: [{ externalSiteId: null }, { externalSiteId }] }] : []),
      ],
    },
    include: {
      user: { select: { name: true } },
      helpfulVotes: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const approvedOnly = reviews.filter((r) => r.isApproved);
  const avgRating =
    approvedOnly.length > 0
      ? approvedOnly.reduce((sum, r) => sum + r.rating, 0) / approvedOnly.length
      : 0;

  return NextResponse.json({
    reviews: reviews.map(({ helpfulVotes, ...r }) => ({
      ...r,
      helpfulCount: helpfulVotes.length,
      votedByMe: session?.user?.id ? helpfulVotes.some((v) => v.userId === session.user.id) : false,
    })),
    avgRating,
    count: approvedOnly.length,
  });
}

export async function POST(req: Request) {
  const limited = rateLimitOrNull(req, "REVIEW_CREATE");
  if (limited) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE(limited.retryAfterSeconds) },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

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

  const { productId, externalId, orderItemId, externalSiteId, productTitle, productImage, rating, comment, images } = parsed.data;
  const source = productId ? "MAZON" : "TRENDYOL";

  // یه مشتری می‌تونه همون محصول رو چند بار بخره و برای هر خرید جدا نظر بده
  // (شاید تجربه‌ی بارِ دوم فرق کرده) -- پس دیگه «یه نظر برای همیشه» نیست، بلکه
  // «یه نظر به‌ازای هر خرید». دو مسیر داریم:
  // فقط اقلامی که واقعاً تحویل/در انتظار تصمیم هستند، نظر می‌گیرن --
  // CANCELLED/LOST/WRONG_SIZE/WRONG_COLOR/ISSUE_OTHER = ریفاند کامل، نظرِ
  // تأییدشده برای چنین قلمی گمراه‌کننده‌ست
  const eligibleStatuses: ("PURCHASED" | "RECEIVED" | "AWAITING_CUSTOMER_DECISION")[] = [
    "PURCHASED",
    "RECEIVED",
    "AWAITING_CUSTOMER_DECISION",
  ];

  let orderItem;
  if (orderItemId) {
    // مسیرِ دقیق: دکمه‌ی «نظر بده» زیرِ یه قلمِ سفارشِ مشخص -- خودِ همون قلم رو
    // verify می‌کنیم (متعلق به همین کاربر، همین محصول، سفارش لغو نشده)
    orderItem = await prisma.orderItem.findFirst({
      where: {
        id: orderItemId,
        purchaseStatus: { in: eligibleStatuses },
        order: { userId: session.user.id, status: { not: "CANCELLED" } },
        ...(productId ? { productId } : { externalId, source: "TRENDYOL" }),
      },
    });
    if (!orderItem) {
      return NextResponse.json({ error: "این خرید معتبر نیست یا متعلق به شما نیست" }, { status: 400 });
    }
    const alreadyReviewed = await prisma.review.findUnique({ where: { orderItemId } });
    if (alreadyReviewed) {
      return NextResponse.json({ error: "شما قبلاً برای همین خرید نظر داده‌اید" }, { status: 409 });
    }
  } else {
    // مسیرِ عمومی (فرمِ صفحه‌ی محصول، بدونِ قلمِ سفارشِ مشخص): اولین خریدِ
    // بی‌نظرِ همین محصول رو پیدا کن -- اگه همه‌ی خریدهاش قبلاً نظر خورده یا
    // اصلاً نخریده، بدونِ اتصال به سفارش (verifiedPurchase=false) ثبت می‌شه
    orderItem = await prisma.orderItem.findFirst({
      where: {
        ...(productId ? { productId } : { externalId, source: "TRENDYOL" }),
        purchaseStatus: { in: eligibleStatuses },
        order: { userId: session.user.id, status: { not: "CANCELLED" } },
        review: null,
      },
    });
    if (!orderItem) {
      // بدونِ خریدِ تازه‌ی بی‌نظر، این مسیرِ عمومی همچنان حداکثر یه نظرِ
      // بی‌تأیید به‌ازای هر محصول اجازه می‌ده -- وگرنه هرکسی (حتی بدونِ خرید)
      // می‌تونست بی‌نهایت نظرِ تکراری بفرسته
      const existingUnlinked = await prisma.review.findFirst({
        where: {
          userId: session.user.id,
          orderItemId: null,
          ...(productId ? { productId } : { externalId, source: "TRENDYOL" }),
        },
      });
      if (existingUnlinked) {
        return NextResponse.json({ error: "شما قبلاً برای این محصول نظر ثبت کرده‌اید" }, { status: 409 });
      }
    }
  }

try {
    if (!orderItemId) {
      // مسیرِ عمومی: چکِ findFirst به‌تنهایی (حتی داخلِ transaction) در برابرِ
      // دو درخواستِ هم‌زمان امن نیست -- بک‌استاپِ واقعی همون قیدِ یکتاییِ
      // UnlinkedReviewClaim است: create روی P2002 شکست می‌خوره و کل تراکنش
      // (شاملِ review.create) رول‌بک می‌شه
      const review = await prisma.$transaction(async (tx) => {
        try {
          await tx.unlinkedReviewClaim.create({
            data: { userId: session.user.id, productKey: productId ? `mazon:${productId}` : `trendyol:${externalId}` },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new Error("DUPLICATE_UNLINKED");
          }
          throw err;
        }
        return tx.review.create({
          data: {
            userId: session.user.id,
            source,
            productId: productId ?? null,
            externalId: externalId ?? null,
            // اگه اتفاقاً یه خریدِ واقعی هم پیدا شد، siteId ازش گرفته می‌شه
            // (دقیق‌تر از ادعای کلاینت)؛ وگرنه از خودِ کلاینت
            externalSiteId: orderItem?.externalSiteId ?? externalSiteId ?? null,
            orderItemId: null,
            rating,
            comment,
            images: JSON.stringify(images),
            verifiedPurchase: false,
            variantLabel: null,
            productTitle: productTitle ?? null,
            productImage: productImage ?? null,
            isApproved: session.user.role === "ADMIN",
          },
        });
      });
      return NextResponse.json(review, { status: 201 });
    } else {
      // مسیرِ دقیق: orderItemId @unique‌BACKSTOPِ دیتابیسی داره (P2002)
      if (!orderItem) {
        return NextResponse.json({ error: "این خرید معتبر نیست" }, { status: 400 });
      }
      const review = await prisma.review.create({
        data: {
          userId: session.user.id,
          source,
          productId: productId ?? null,
          externalId: externalId ?? null,
          // از خودِ OrderItem می‌آد، نه از کلاینت -- سایتِ واقعیِ خریدِ تأییدشده
          externalSiteId: orderItem.externalSiteId,
          orderItemId: orderItem.id,
          rating,
          comment,
          images: JSON.stringify(images),
          verifiedPurchase: true,
          variantLabel: orderItem.variantLabel ?? null,
          productTitle: orderItem.title,
          productImage: orderItem.image,
          isApproved: session.user.role === "ADMIN",
        },
      });
      return NextResponse.json(review, { status: 201 });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: "شما قبلاً برای این خرید نظر ثبت کرده‌اید" },
          { status: 409 }
        );
      }
      if (err.code === "P2003") {
        return NextResponse.json(
          { error: "حساب کاربری شما دیگر معتبر نیست. لطفاً خارج شوید و دوباره وارد شوید." },
          { status: 401 }
        );
      }
    }
    if (err instanceof Error && err.message === "DUPLICATE_UNLINKED") {
      return NextResponse.json(
        { error: "شما قبلاً برای این محصول نظر ثبت کرده‌اید" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "خطا در ثبت نظر" }, { status: 500 });
}
}
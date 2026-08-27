import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// اقلامِ سفارش‌هایی که برای کاربرِ لاگین‌کرده تحویل داده شده ولی هنوز نظری
// براشون ثبت نکرده -- برای دکمه‌ی «نظر بده» زیر هر قلم توی صفحه‌ی سفارش، و
// پاپ‌آپِ یادآوریِ نظر. هر قلمِ سفارش (نه هر محصول) جدا حساب می‌شه -- اگه
// همون محصول رو چندبار خریده، هر خریدِ بی‌نظر جدا توی این لیست میاد
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] });
  }

  // فقط اقلامی که واقعاً تحویل/در انتظار تصمیم هستند --
  // CANCELLED/LOST/WRONG_SIZE/WRONG_COLOR/ISSUE_OTHER = ریفاند کامل
  const eligibleStatuses: ("PURCHASED" | "RECEIVED" | "AWAITING_CUSTOMER_DECISION")[] = [
    "PURCHASED",
    "RECEIVED",
    "AWAITING_CUSTOMER_DECISION",
  ];

  const items = await prisma.orderItem.findMany({
    where: {
      order: { userId: session.user.id, status: "DELIVERED" },
      purchaseStatus: { in: eligibleStatuses },
      review: null,
    },
    orderBy: { id: "desc" },
    take: 10,
    select: {
      id: true,
      orderId: true,
      source: true,
      productId: true,
      externalId: true,
      title: true,
      image: true,
      variantLabel: true,
    },
  });

  return NextResponse.json({ items });
}

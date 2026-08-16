import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { code, subtotal } = await req.json();
  if (!code || typeof subtotal !== "number") {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });

  if (!coupon || !coupon.isActive) {
    return NextResponse.json({ error: "کد تخفیف نامعتبر است" }, { status: 400 });
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return NextResponse.json({ error: "این کد تخفیف منقضی شده است" }, { status: 400 });
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return NextResponse.json({ error: "ظرفیت این کد تخفیف تمام شده است" }, { status: 400 });
  }
  if (subtotal < coupon.minOrderAmount) {
    return NextResponse.json(
      {
        error: `حداقل مبلغ سفارش برای این کد ${coupon.minOrderAmount.toLocaleString(
          "fa-IR"
        )} تومان است`,
      },
      { status: 400 }
    );
  }

  if (coupon.type === "FIRST_BUY") {
    const previousOrders = await prisma.order.count({
      where: { userId: session.user.id, status: { not: "CANCELLED" } },
    });
    if (previousOrders > 0) {
      return NextResponse.json(
        { error: "این کد فقط برای اولین خرید معتبر است" },
        { status: 400 }
      );
    }
  }

  let discountAmount = 0;
  let freeShipping = false;

  switch (coupon.type) {
    case "PERCENT":
      discountAmount = Math.round((subtotal * coupon.value) / 100);
      break;
    case "FIXED":
      discountAmount = Math.min(coupon.value, subtotal);
      break;
    case "FREE_SHIP":
      freeShipping = true;
      break;
    case "FIRST_BUY":
      discountAmount = Math.round((subtotal * coupon.value) / 100);
      break;
  }

  return NextResponse.json({
    valid: true,
    code: coupon.code,
    type: coupon.type,
    discountAmount,
    freeShipping,
  });
}

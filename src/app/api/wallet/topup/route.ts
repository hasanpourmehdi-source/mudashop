import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyWalletTransaction } from "@/lib/wallet";
import { z } from "zod";

const topupSchema = z.object({
  amount: z.number().int().positive("مبلغ باید مثبت باشد").max(50_000_000, "مبلغ نمی‌تواند بیشتر از ۵۰,۰۰۰,۰۰۰ تومان باشد"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = topupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "مبلغ نامعتبر است" }, { status: 400 });
  }

  // شبیه‌سازی درگاه پرداخت: در فاز ۵ اینجا به Zarinpal وصل می‌شه.
  // فعلاً بلافاصله موفق فرض می‌شه (دقیقاً مثل بقیه شبیه‌سازی‌های پرداخت پروژه).
  const wallet = await prisma.$transaction((tx) =>
    applyWalletTransaction(tx, {
      userId: session.user.id,
      amount: parsed.data.amount,
      type: "TOPUP",
      description: "شارژ کیف پول (شبیه‌سازی پرداخت)",
    })
  );

  return NextResponse.json(wallet);
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redeemGiftCard } from "@/lib/giftCard";
import { z } from "zod";

const redeemSchema = z.object({
  code: z.string().trim().min(6, "کد وارد شده معتبر نیست").max(30),
});

// فعال‌سازی کارت هدیه با کد: موجودی کارت به کیف پول کاربر اضافه می‌شه
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = redeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "کد وارد شده معتبر نیست" }, { status: 400 });
  }

  try {
    const amount = await redeemGiftCard(session.user.id, parsed.data.code);
    return NextResponse.json({
      success: true,
      amount,
      message: `${amount.toLocaleString("fa-IR")} تومان به کیف پولت اضافه شد 🎁`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "کد نامعتبر است" }, { status: 400 });
  }
}
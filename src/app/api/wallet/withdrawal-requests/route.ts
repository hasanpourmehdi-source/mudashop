import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyWalletTransaction, getOrCreateWallet } from "@/lib/wallet";
import { z } from "zod";

const schema = z.object({
  amount: z.number().int().positive("مبلغ باید مثبت باشد"),
  cardNumber: z.string().trim().min(10, "شماره کارت را کامل وارد کنید").max(30),
  shebaNumber: z.string().trim().max(30).optional(),
  holderName: z.string().trim().min(1, "نام صاحب حساب را وارد کنید").max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const requests = await prisma.walletWithdrawalRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(requests);
}

// درخواست واریز موجودی کیف پول به حساب مشتری -- موجودی همون لحظه از کیف پول
// کسر می‌شه (تا دوبار خرج نشه)، بعد ادمین با آپلود عکس فیش تکمیلش می‌کنه یا
// رد می‌کنه (که یعنی برگشت به کیف پول)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const existingPending = await prisma.walletWithdrawalRequest.findFirst({
    where: { userId, status: "PENDING" },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "شما یک درخواست واریز در حال بررسی دارید -- تا تعیین نتیجه‌ی آن، درخواست جدیدی نمی‌توانید ثبت کنید" },
      { status: 400 }
    );
  }

  const wallet = await getOrCreateWallet(userId);
  if (parsed.data.amount > wallet.balance) {
    return NextResponse.json({ error: "موجودی کیف پول کافی نیست" }, { status: 400 });
  }

  const { amount, cardNumber, shebaNumber, holderName } = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    await applyWalletTransaction(tx, {
      userId,
      amount,
      type: "WITHDRAWAL",
      description: `درخواست واریز به کارت ${cardNumber}`,
    });
    return tx.walletWithdrawalRequest.create({
      data: {
        userId,
        amount,
        cardNumber,
        shebaNumber: shebaNumber || null,
        holderName,
      },
    });
  });

  // برخلاف notifyAdminsOnce (که برای هشدارهای پس‌زمینه‌ی تکرارشونده dedupe
  // می‌کنه)، هر درخواست واریز یه اقدام واقعی و مجزاست -- نباید به‌خاطر یه
  // درخواست مشابهِ نزدیک به این یکی، از چشم ادمین بیفته
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        message: `درخواست واریز ${amount.toLocaleString("fa-IR")} تومانی از کیف پول ثبت شد -- برای بررسی به بخش «درخواست‌های واریز کیف پول» مراجعه کنید.`,
        link: "/admin/wallet-withdrawals",
      })),
    });
  }

  return NextResponse.json(created);
}

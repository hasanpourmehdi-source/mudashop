import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

export async function getOrCreateWallet(userId: string, client: TxClient = prisma) {
  const existing = await client.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return client.wallet.create({ data: { userId, balance: 0 } });
}

// واریز/برداشت اتمیک از کیف پول + ثبت تراکنش. amount همیشه مثبت.
export async function applyWalletTransaction(
  client: TxClient,
  params: {
    userId: string;
    amount: number;
    type: "TOPUP" | "PURCHASE" | "REFUND" | "WITHDRAWAL" | "LOYALTY" | "GIFT_CARD" | "REFERRAL";
    description: string;
    orderId?: string;
  }
) {
  const wallet = await getOrCreateWallet(params.userId, client);
  const isCredit = ["TOPUP", "REFUND", "LOYALTY", "GIFT_CARD", "REFERRAL"].includes(params.type);

  let updated;
  if (isCredit) {
    updated = await client.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: params.amount } },
    });
  } else {
    // برداشت باید اتمیک باشد: balance را فقط اگر کافی باشد کم کن
    // (updateMany با شرط balance >= amount)، وگرنه بین چک و update
    // تراکنشِ همزمان می‌تونه موجودی را منفی کند
    const res = await client.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: params.amount } },
      data: { balance: { decrement: params.amount } },
    });
    if (res.count === 0) {
      throw new Error("موجودی کیف پول کافی نیست");
    }
    updated = await client.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
  }

  await client.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: params.type,
      amount: params.amount,
      description: params.description,
      orderId: params.orderId,
    },
  });

  return updated;
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrCreateWallet } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const wallet = await getOrCreateWallet(session.user.id);
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ balance: wallet.balance, transactions });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const requests = await prisma.walletWithdrawalRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  // درخواست‌های در حال بررسی همیشه بالای لیست -- ادمین اول باید همین‌ها رو ببینه
  requests.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));
  return NextResponse.json(requests);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

// جست‌وجوی کاربرانِ CUSTOMERِ موجود (با اسم/ایمیل) برای «ارتقاء به کارمند» --
// فقط ADMINِ کامل (بدون scope، هم‌راستا با بقیه‌ی روت‌های staff). عمداً فقط
// CUSTOMER برمی‌گردونیم -- ADMIN/STAFFِ از قبل موجود توی این جست‌وجو معنی نداره
export async function GET(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      OR: [{ email: { contains: q } }, { name: { contains: q } }],
    },
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return NextResponse.json({ results });
}

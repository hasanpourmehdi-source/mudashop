import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const updateSchema = z.object({
  role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "BANNED"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  // ادمین نمی‌تونه نقش/وضعیت خودش رو از همین پنل عوض کنه -- جلوگیری از قفل
  // شدن تصادفی خودش (دموت‌کردن یا مسدودکردن حساب خودش)
  if (id === adminCheck.session.user.id) {
    return NextResponse.json(
      { error: "نمی‌توانید نقش یا وضعیت حساب خودتان را تغییر دهید" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  }

  const user = await prisma.user.update({ where: { id }, data: parsed.data });
  return NextResponse.json(user);
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const schema = z.object({
  newPassword: z.string().min(6, "رمز جدید باید حداقل ۶ کاراکتر باشد"),
});

// ادمین رمز عبور یک کاربر رو مستقیم عوض می‌کنه -- برخلاف تغییر رمز خودِ کاربر
// (src/app/api/profile/change-password/route.ts)، نیازی به دانستن رمز قبلی نیست
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id }, data: { password: hashed } });

  return NextResponse.json({ success: true });
}

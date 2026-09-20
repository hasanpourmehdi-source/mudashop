import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { ADMIN_SCOPES } from "@/lib/adminPermissions";

const promoteSchema = z.object({
  userId: z.string().min(1),
  scopes: z.array(z.enum(ADMIN_SCOPES)),
});

// ارتقاءِ یه حسابِ CUSTOMERِ از قبل موجود به STAFF -- بدونِ ساختنِ حسابِ جدید،
// بدونِ دست‌زدن به رمز/سفارش‌ها/کیف‌پولِ همون کاربر؛ فقط role و adminScopes
// عوض می‌شه (دقیقاً همون کاری که DELETEِ [id]/route.ts برعکسش رو انجام می‌ده).
// عمداً فقط CUSTOMER قابلِ ارتقاءه -- ارتقاءِ یه ADMIN یا STAFFِ از قبل موجود
// بی‌معنیه (و برای ADMIN حتی خطرناک، چون دسترسیش رو محدود می‌کرد)
export async function POST(req: Request) {
  const { ok, session } = await requireAdmin();
  if (!ok || !session) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = promoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }
  const { userId, scopes } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, role: true } });
  if (!target) {
    return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  }
  if (target.role !== "CUSTOMER") {
    return NextResponse.json({ error: "این کاربر از قبل مشتریِ عادی نیست (ادمین/کارمنده)" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: "STAFF", adminScopes: JSON.stringify(scopes) },
  });

  await logAdminAction({
    adminId: session.user.id,
    adminName: session.user.name ?? "",
    adminEmail: session.user.email ?? "",
    action: "STAFF_PROMOTED_FROM_CUSTOMER",
    targetType: "User",
    targetId: userId,
    detail: `${target.email} با دسترسی: ${scopes.join(", ") || "(هیچ)"}`,
  });

  return NextResponse.json({ id: userId, name: target.name, email: target.email }, { status: 201 });
}

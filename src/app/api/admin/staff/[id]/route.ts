import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { ADMIN_SCOPES } from "@/lib/adminPermissions";

const patchSchema = z.object({ scopes: z.array(z.enum(ADMIN_SCOPES)) });

// تغییرِ حیطه‌ی دسترسیِ یک حساب STAFF -- فقط ADMIN کامل (نه STAFF دیگری)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, session } = await requireAdmin();
  if (!ok || !session) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true } });
  if (!target || target.role !== "STAFF") {
    return NextResponse.json({ error: "کارمند یافت نشد" }, { status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { adminScopes: JSON.stringify(parsed.data.scopes) } });

  await logAdminAction({
    adminId: session.user.id,
    adminName: session.user.name ?? "",
    adminEmail: session.user.email ?? "",
    action: "STAFF_SCOPES_UPDATED",
    targetType: "User",
    targetId: id,
    detail: `${target.email} -> دسترسی جدید: ${parsed.data.scopes.join(", ") || "(هیچ)"}`,
  });

  return NextResponse.json({ ok: true });
}

// لغوِ کاملِ دسترسیِ کارمند -- به‌جای حذفِ ردیفِ کاربر (که با هر رابطه‌ی دیگه‌ای
// تداخل ایجاد می‌کرد)، فقط نقشش به CUSTOMER برمی‌گردد و scopeهاش خالی می‌شود
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, session } = await requireAdmin();
  if (!ok || !session) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true } });
  if (!target || target.role !== "STAFF") {
    return NextResponse.json({ error: "کارمند یافت نشد" }, { status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { role: "CUSTOMER", adminScopes: "[]" } });

  await logAdminAction({
    adminId: session.user.id,
    adminName: session.user.name ?? "",
    adminEmail: session.user.email ?? "",
    action: "STAFF_REMOVED",
    targetType: "User",
    targetId: id,
    detail: target.email,
  });

  return NextResponse.json({ ok: true });
}

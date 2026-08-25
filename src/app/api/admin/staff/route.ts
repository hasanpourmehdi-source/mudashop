import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { ADMIN_SCOPES, parseAdminScopes } from "@/lib/adminPermissions";

// مدیریت حساب‌های STAFF (دسترسیِ محدود) عمداً فقط با requireAdmin() بدون
// scope باز است -- یعنی فقط ADMIN کامل، نه هیچ STAFFای دیگه، وگرنه یه حساب
// STAFF می‌توانست به خودش/به یکیِ دیگه دسترسیِ بیشتری بدهد
const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  scopes: z.array(z.enum(ADMIN_SCOPES)),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const staff = await prisma.user.findMany({
    where: { role: "STAFF" },
    select: { id: true, name: true, email: true, adminScopes: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    staff.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      status: s.status,
      createdAt: s.createdAt,
      scopes: parseAdminScopes(s.adminScopes),
    }))
  );
}

export async function POST(req: Request) {
  const { ok, session } = await requireAdmin();
  if (!ok || !session) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }
  const { name, email, password, scopes } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "این ایمیل قبلاً ثبت‌نام کرده است" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const staff = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "STAFF",
      adminScopes: JSON.stringify(scopes),
    },
    select: { id: true, name: true, email: true },
  });

  await logAdminAction({
    adminId: session.user.id,
    adminName: session.user.name ?? "",
    adminEmail: session.user.email ?? "",
    action: "STAFF_CREATED",
    targetType: "User",
    targetId: staff.id,
    detail: `${staff.email} با دسترسی: ${scopes.join(", ") || "(هیچ)"}`,
  });

  return NextResponse.json(staff, { status: 201 });
}

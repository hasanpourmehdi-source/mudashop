import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseAdminScopes, type AdminScope } from "@/lib/adminPermissions";

// بدون scope: فقط ADMIN رد می‌شه (رفتار قبلی، بدون تغییر -- بیشتر از ۸۰ روتِ
// موجود به همین شکل صداش می‌زنن و نباید STAFF رو ناخواسته راه بدن).
// با scope: ADMIN همیشه رد می‌شه، STAFF فقط اگه دقیقاً همون scope رو داشته
// باشد (تازه از دیتابیس خونده می‌شه، نه از JWT -- تا لغوِ دسترسی فوری اثر کند)
export async function requireAdmin(scope?: AdminScope) {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, session: null };
  }

  if (session.user.role === "ADMIN") {
    return { ok: true as const, session };
  }

  if (scope && session.user.role === "STAFF") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { adminScopes: true },
    });
    if (user && parseAdminScopes(user.adminScopes).includes(scope)) {
      return { ok: true as const, session };
    }
  }

  return { ok: false as const, session: null };
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseAdminScopes, type AdminScope } from "@/lib/adminPermissions";

// نقشه‌ی حیطه -> لینک واقعیِ صفحه‌ش توی همین پرتال. هر حیطه‌ی جدید که بعداً
// یه صفحه‌ی واقعی زیر /staff گرفت، همین‌جا اضافه می‌شه
const SCOPE_LINKS: Partial<Record<AdminScope, { href: string; label: string }>> = {
  SUPPORT: { href: "/staff/support", label: "پیام‌های پشتیبانی" },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  // ADMIN کامل هم اجازه‌ی دیدنِ این پرتال رو دارد (برای تست/سرکشی)، ولی
  // scopeهاش همیشه «همه‌چی»ه؛ برای STAFF از دیتابیس تازه می‌خونیم (میدل‌ور
  // از قبل تضمین کرده که نقش فقط ADMIN یا STAFF است، نه CUSTOMER)
  const scopes: AdminScope[] =
    session.user.role === "ADMIN"
      ? (Object.keys(SCOPE_LINKS) as AdminScope[])
      : parseAdminScopes(
          (await prisma.user.findUnique({ where: { id: session.user.id }, select: { adminScopes: true } }))
            ?.adminScopes ?? "[]"
        );

  const links = scopes.map((s) => SCOPE_LINKS[s]).filter((l): l is { href: string; label: string } => !!l);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-[190px_1fr] gap-8">
      <aside className="space-y-1.5 text-sm md:sticky md:top-4 md:self-start">
        <p className="text-[10px] font-bold text-[var(--color-muted)] tracking-wide px-1 mb-2">پرتال کارمندان</p>
        {links.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)] px-1">هنوز هیچ دسترسی‌ای برایت تعیین نشده.</p>
        ) : (
          links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-lg px-2 py-1.5 font-medium hover:bg-[var(--color-linen-dim)] transition-colors"
            >
              {link.label}
            </Link>
          ))
        )}
      </aside>
      <div>{children}</div>
    </div>
  );
}

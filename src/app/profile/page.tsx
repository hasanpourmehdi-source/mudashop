import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  // مستقیم از دیتابیس می‌خونیم (نه فقط session) تا phone و وضعیت رمز عبور رو هم داشته باشیم
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, role: true, password: true },
  });
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <h1 className="text-xl font-bold">پروفایل من</h1>

      <div className="border cut-line rounded-lg p-6 bg-white space-y-2 text-sm">
        <p>
          <span className="text-[var(--color-muted)]">ایمیل: </span>
          {user.email}
          <span className="text-[10px] text-[var(--color-muted)] mr-1">(غیرقابل تغییر)</span>
        </p>
        <p>
          <span className="text-[var(--color-muted)]">نقش: </span>
          {user.role === "ADMIN" ? "ادمین" : "مشتری"}
        </p>
      </div>

      <ProfileEditForm initialName={user.name ?? ""} initialPhone={user.phone ?? ""} />

      {user.password ? (
        <ChangePasswordForm />
      ) : (
        <p className="text-xs text-[var(--color-muted)]">
          چون با گوگل وارد شدی، این حساب رمز عبور جداگانه‌ای نداره.
        </p>
      )}

      <div className="flex gap-3">
        <Link
          href="/orders"
          className="inline-block bg-[var(--color-wine)] text-white px-5 py-2.5 rounded-full text-sm font-medium"
        >
          سفارش‌های من
        </Link>
        <Link
          href="/wallet"
          className="inline-block border cut-line px-5 py-2.5 rounded-full text-sm font-medium bg-white"
        >
          کیف پول
        </Link>
      </div>
    </div>
  );
}

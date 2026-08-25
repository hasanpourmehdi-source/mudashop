import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { NotificationSettingsForm } from "@/components/NotificationSettingsForm";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  // مستقیم از دیتابیس می‌خونیم (نه فقط session) تا phone و وضعیت رمز عبور رو هم داشته باشیم
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, role: true, password: true, emailVerified: true },
  });
  if (!user) redirect("/auth/login");

  const quickLinks = [
    { href: "/orders", icon: "📦", label: "سفارش‌های من", bg: "#fdeaf1" },
    { href: "/wallet", icon: "👛", label: "کیف پول", bg: "#e6f7ef" },
    { href: "/addresses", icon: "📍", label: "آدرس‌های من", bg: "#eaf1fd" },
    { href: "/loyalty", icon: "🎁", label: "کارت هدیه و وفاداری", bg: "#fff4e0" },
    { href: "/referral", icon: "🤝", label: "کد معرفی", bg: "#f5eaff" },
    { href: "/messages", icon: "💬", label: "پیام‌ها", bg: "#fdeaea" },
    { href: "/profile/security", icon: "🔐", label: "امنیت و دستگاه‌ها", bg: "#f1eafd" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <h1 className="text-xl font-bold">پروفایل من</h1>

      {!user.emailVerified && user.password && <EmailVerificationBanner />}

      <div className="flex gap-6 overflow-x-auto pb-1">
        {quickLinks.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center gap-2 shrink-0 w-20 group"
          >
            <span
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border cut-line group-hover:border-[var(--color-wine)] transition-colors"
              style={{ background: item.bg }}
            >
              {item.icon}
            </span>
            <span className="text-xs text-center font-medium leading-tight">{item.label}</span>
          </Link>
        ))}
      </div>

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

      <NotificationSettingsForm />

      {user.password ? (
        <ChangePasswordForm />
      ) : (
        <p className="text-xs text-[var(--color-muted)]">
          چون با گوگل وارد شدی، این حساب رمز عبور جداگانه‌ای نداره.
        </p>
      )}
    </div>
  );
}

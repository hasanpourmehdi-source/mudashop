"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };
type NavSection = { title?: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/admin", label: "داشبورد" },
      { href: "/admin/reports", label: "گزارشات" },
    ],
  },
  {
    title: "کاتالوگ",
    items: [
      { href: "/admin/products", label: "محصولات" },
      { href: "/admin/categories", label: "دسته‌بندی‌ها" },
      { href: "/admin/brands", label: "برندها" },
      { href: "/admin/attributes", label: "ویژگی‌ها" },
      { href: "/admin/attribute-groups", label: "گروه‌های ویژگی" },
      { href: "/admin/size-guides", label: "راهنمای سایز" },
      { href: "/admin/external-sites", label: "سایت‌های خارجی" },
      { href: "/admin/trendyol-categories", label: "دسته‌بندی‌های ترندیول" },
      { href: "/admin/trendyol-filters", label: "فیلترهای ترندیول" },
      { href: "/admin/trendyol-title-dictionary", label: "دیکشنری عنوان ترندیول" },
      { href: "/admin/trendyol-fetch-logs", label: "لاگ خطاهای ترندیول" },
    ],
  },
  {
    title: "فروش",
    items: [
      { href: "/admin/orders", label: "سفارش‌ها" },
      { href: "/admin/coupons", label: "کدهای تخفیف" },
      { href: "/admin/flash-sales", label: "حراج فلش" },
      { href: "/admin/campaigns", label: "کمپین برندها" },
      { href: "/admin/stock-notifications", label: "درخواست موجودی" },
      { href: "/admin/price-alerts", label: "اخطار کاهش قیمت" },
      { href: "/admin/gift-cards", label: "کارت هدیه" },
      { href: "/admin/shipments", label: "محموله‌های ترکیبی" },
      { href: "/admin/poster-generator", label: "پوستر اینستاگرام" },
      { href: "/admin/blog", label: "مجله/بلاگ" },
    ],
  },
  {
    title: "کاربران",
    items: [
      { href: "/admin/users", label: "کاربران" },
      { href: "/admin/wallet-withdrawals", label: "درخواست‌های واریز کیف پول" },
      { href: "/admin/staff", label: "کارمندان (دسترسی محدود)" },
      { href: "/admin/audit-log", label: "لاگ فعالیت ادمین" },
      { href: "/admin/error-log", label: "لاگ خطاهای سایت" },
    ],
  },
  {
    title: "پشتیبانی",
    items: [
      { href: "/admin/questions", label: "پرسش و پاسخ" },
      { href: "/admin/reviews", label: "نظرات" },
      { href: "/admin/support", label: "چت پشتیبانی" },
    ],
  },
  {
    title: "تنظیمات",
    items: [
      { href: "/admin/settings", label: "متن‌های سایت" },
      { href: "/admin/exchange-rates", label: "نرخ ارز" },
      { href: "/admin/bank-cards", label: "کارت‌های بانکی" },
      { href: "/admin/outbound-notifications", label: "لاگ ایمیل/پیامک" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-[190px_1fr] gap-8">
      <aside className="space-y-5 text-sm md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto pl-1 pb-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i} className="space-y-1.5">
            {section.title && (
              <p className="text-[10px] font-bold text-[var(--color-muted)] tracking-wide px-1">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-2 py-1.5 font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--color-ochre)] text-[var(--color-ink)]"
                      : "hover:bg-[var(--color-linen-dim)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>
      <div>{children}</div>
    </div>
  );
}

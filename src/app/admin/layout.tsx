"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type NavItem = { href: string; label: string };
// زیرگروهِ قابلِ‌جمع‌شدن -- برای دسته‌ای از لینک‌های خیلی مرتبط/کم‌استفاده‌تر
// (مثلاً همه‌چیزِ «سایت‌های خارجی») که اسم‌هاشون هم قبلاً تکراری/طولانی بود
// («دسته‌بندی‌های سایت‌های خارجی»، «فیلترهای سایت‌های خارجی»، ...) -- زیرِ یه
// عنوانِ مشترک جمع می‌شن و اسمِ هرکدوم کوتاه‌تر می‌شه چون زمینه‌ش از عنوانِ
// گروه معلومه
type NavGroup = { label: string; icon?: string; items: NavItem[] };
type NavEntry = NavItem | NavGroup;
type NavSection = { title?: string; icon?: string; items: NavEntry[] };

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/admin", label: "داشبورد" },
      { href: "/admin/reports", label: "گزارشات" },
    ],
  },
  {
    title: "کاتالوگ",
    icon: "🗂️",
    items: [
      { href: "/admin/products", label: "محصولات" },
      { href: "/admin/categories", label: "دسته‌بندی‌ها" },
      { href: "/admin/brands", label: "برندها" },
      { href: "/admin/attributes", label: "ویژگی‌ها" },
      { href: "/admin/attribute-groups", label: "گروه‌های ویژگی" },
      { href: "/admin/size-guides", label: "راهنمای سایز" },
      {
        label: "سایت‌های خارجی",
        icon: "🌐",
        items: [
          { href: "/admin/external-sites", label: "سایت‌ها" },
          { href: "/admin/trendyol-categories", label: "دسته‌بندی‌ها" },
          { href: "/admin/trendyol-filters", label: "فیلترها" },
          { href: "/admin/trendyol-title-dictionary", label: "دیکشنری عنوان" },
          { href: "/admin/trendyol-campaign-formulas", label: "فرمول‌های اسمِ کمپین" },
          { href: "/admin/trendyol-fetch-logs", label: "لاگ خطاها" },
        ],
      },
    ],
  },
  {
    title: "فروش",
    icon: "🛒",
    items: [
      { href: "/admin/orders", label: "سفارش‌ها" },
      { href: "/admin/coupons", label: "کدهای تخفیف" },
      { href: "/admin/flash-sales", label: "حراج فلش" },
      { href: "/admin/campaigns", label: "کمپین برندها" },
      { href: "/admin/occasion-collections", label: "مجموعه‌های مناسبتی" },
      { href: "/admin/stock-notifications", label: "درخواست موجودی" },
      { href: "/admin/price-alerts", label: "اخطار کاهش قیمت" },
      { href: "/admin/gift-cards", label: "کارت هدیه" },
      { href: "/admin/shipments", label: "محموله‌های ترکیبی" },
      { href: "/admin/customer-shipments", label: "ارسالی مشتریان" },
      { href: "/admin/poster-generator", label: "پوستر اینستاگرام" },
      { href: "/admin/blog", label: "مجله/بلاگ" },
    ],
  },
  {
    title: "کاربران",
    icon: "👥",
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
    icon: "💬",
    items: [
      { href: "/admin/questions", label: "پرسش و پاسخ" },
      { href: "/admin/reviews", label: "نظرات" },
      { href: "/admin/support", label: "چت پشتیبانی" },
      { href: "/admin/price-reports", label: "گزارش قیمت مناسب‌تر" },
    ],
  },
  {
    title: "تنظیمات",
    icon: "⚙️",
    items: [
      { href: "/admin/feature-flags", label: "امکانات فروشگاه" },
      { href: "/admin/settings", label: "متن‌های سایت" },
      { href: "/admin/other-settings", label: "سایر تنظیمات" },
      { href: "/admin/exchange-rates", label: "نرخ ارز" },
      { href: "/admin/bank-cards", label: "کارت‌های بانکی" },
      { href: "/admin/outbound-notifications", label: "لاگ ایمیل/پیامک" },
    ],
  },
];

// وقتی صفحه‌ی پوسترساز از طریقِ اشتراک‌گذاری (Web Share Target -- ?url=/?text=/
// ?title=) یا لینکِ «ساخت پست اینستاگرام» (?input=) باز شده باشه -- یعنی ادمین
// فقط یه لحظه اومده پوستر بسازه و بره -- منوی کناریِ بلند حذف می‌شه، چون فقط
// شلوغیه؛ وقتی از خودِ منو کلیک بشه (بدونِ این کوئری‌پارامترها) هیچ فرقی نمی‌کنه
const FOCUSED_MODE_PATH = "/admin/poster-generator";
const FOCUSED_MODE_PARAMS = ["url", "text", "title", "input"];

function isFocusedModeUrl(pathname: string, search: string): boolean {
  if (pathname !== FOCUSED_MODE_PATH) return false;
  const params = new URLSearchParams(search);
  return FOCUSED_MODE_PARAMS.some((key) => !!params.get(key));
}

function isActiveHref(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
}

function entriesContainPath(entries: NavEntry[], pathname: string): boolean {
  return entries.some((e) => (isGroup(e) ? entriesContainPath(e.items, pathname) : isActiveHref(e.href, pathname)));
}

// کدومِ گروه/سکشن‌ها باید پیش‌فرض باز باشن -- همونایی که صفحه‌ی فعلی توشونه.
// «سایت‌های خارجی» (تنها زیرگروه) با کلیدِ ترکیبیِ «کاتالوگ>سایت‌های خارجی»
function collectDefaultOpenKeys(pathname: string): Set<string> {
  const keys = new Set<string>();
  NAV_SECTIONS.forEach((section, i) => {
    const sectionKey = section.title ?? `s${i}`;
    if (entriesContainPath(section.items, pathname)) keys.add(sectionKey);
    for (const entry of section.items) {
      if (isGroup(entry) && entriesContainPath(entry.items, pathname)) {
        keys.add(`${sectionKey}>${entry.label}`);
      }
    }
  });
  return keys;
}

function NavLinkRow({
  item,
  pathname,
  onNavigate,
  nested,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const isActive = isActiveHref(item.href, pathname);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`block rounded-lg px-2 py-1.5 font-medium transition-colors ${nested ? "mr-3 text-[13px]" : ""} ${
        isActive ? "bg-[var(--color-ochre)] text-[var(--color-ink)]" : "hover:bg-[var(--color-linen-dim)]"
      }`}
    >
      {item.label}
    </Link>
  );
}

function NavGroupRow({
  group,
  sectionKey,
  pathname,
  onNavigate,
  openKeys,
  toggle,
}: {
  group: NavGroup;
  sectionKey: string;
  pathname: string;
  onNavigate?: () => void;
  openKeys: Set<string>;
  toggle: (key: string) => void;
}) {
  const key = `${sectionKey}>${group.label}`;
  const isOpen = openKeys.has(key);
  return (
    <div>
      <button
        type="button"
        onClick={() => toggle(key)}
        className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 font-medium hover:bg-[var(--color-linen-dim)] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {group.icon && <span>{group.icon}</span>}
          {group.label}
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">{isOpen ? "▾" : "◂"}</span>
      </button>
      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          {group.items.map((item) => (
            <NavLinkRow key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} nested />
          ))}
        </div>
      )}
    </div>
  );
}

// لیستِ لینک‌ها -- هم توی نوارِ کناریِ همیشه‌دیده‌ی دسکتاپ، هم توی کشوی
// موبایل استفاده می‌شه؛ onNavigate فقط توی کشوی موبایل پر می‌شه (برای
// بستنِ خودکارِ کشو بعدِ زدنِ یه لینک). فقط زیرگروهِ «سایت‌های خارجی» جمع‌شونده‌ست
// (بقیه‌ی سکشن‌ها همیشه باز می‌مونن تا صفحه‌های پراستفاده یه کلیکِ اضافه نخوان)
function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => collectDefaultOpenKeys(pathname));

  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      collectDefaultOpenKeys(pathname).forEach((k) => next.add(k));
      return next;
    });
  }, [pathname]);

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      {NAV_SECTIONS.map((section, i) => {
        const sectionKey = section.title ?? `s${i}`;
        return (
          <div key={sectionKey} className="space-y-1">
            {section.title && (
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-muted)] tracking-wide px-1">
                {section.icon && <span className="text-xs">{section.icon}</span>}
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((entry) =>
                isGroup(entry) ? (
                  <NavGroupRow
                    key={entry.label}
                    group={entry}
                    sectionKey={sectionKey}
                    pathname={pathname}
                    onNavigate={onNavigate}
                    openKeys={openKeys}
                    toggle={toggle}
                  />
                ) : (
                  <NavLinkRow key={entry.href} item={entry} pathname={pathname} onNavigate={onNavigate} />
                )
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // مقدارِ اولیه false (نه از window.location) که با رندرِ سمتِ سرور یکی
  // بمونه -- بعدِ mount توی afterEffect درستش می‌کنیم، نه حینِ خودِ رندر
  const [focusedMode, setFocusedMode] = useState(false);
  // توی موبایل، لیستِ کاملِ نوارِ کناری (~۴۰ لینک) قبلِ خودِ محتوا افتاده بود
  // پایینِ صفحه و مجبور بودی کلی اسکرول کنی تا برسی به فرم؛ حالا فقط یه دکمه‌ی
  // ☰ هست و لیست توی یه کشو (drawer) میاد -- دقیقاً مثل «☰ دسته‌بندی» فروشگاه
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setFocusedMode(isFocusedModeUrl(pathname, window.location.search));
  }, [pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (focusedMode) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/admin" className="text-sm text-[var(--color-wine)] hover:underline">
          ‹ پنل ادمین
        </Link>
        <div className="mt-4">{children}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-8 grid grid-cols-1 md:grid-cols-[190px_1fr] gap-3 md:gap-8">
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="md:hidden flex items-center gap-1.5 self-start px-3 py-2 rounded-full border cut-line text-sm font-medium bg-white hover:bg-[var(--color-linen-dim)]"
      >
        <span>☰</span>
        <span>فهرست پنل ادمین</span>
      </button>

      {mobileNavOpen &&
        createPortal(
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          >
            <div
              className="absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-white overflow-y-auto p-4 space-y-5 text-sm shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold">پنل ادمین</p>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="بستن"
                  className="text-lg leading-none px-2 hover:text-[var(--color-wine)]"
                >
                  ✕
                </button>
              </div>
              <NavList pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>,
          document.body
        )}

      {/* tabIndex=0: بدونش، وقتی فوکوسِ کیبورد داخلِ این ستون نباشه، کلیدِ
          پایین/بالا صفحه‌ی اصلی رو اسکرول می‌کنه، نه این نوارِ کناریِ خودش رو
          (چون مرورگر کلیدهای اسکرول رو به نزدیک‌ترین scrollable ancestorِ
          عنصرِ فوکوس‌شده می‌فرسته، نه چیزی که فقط زیرِ موس باشه) -- با این، خودِ
          ستون هم قابلِ فوکوس‌شدنه (با کلیک یا Tab) و از همون‌جا اسکرول می‌شه.
          فقط از md به بالا دیده می‌شه -- زیرِ md همون کشوی بالا جایگزینش می‌شه */}
      <aside
        tabIndex={0}
        className="hidden md:block space-y-5 text-sm md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto pl-1 pb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wine)] focus-visible:ring-offset-2 rounded-lg"
      >
        <NavList pathname={pathname} />
      </aside>
      <div>{children}</div>
    </div>
  );
}

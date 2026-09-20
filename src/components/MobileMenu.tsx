"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBox } from "@/components/SearchBox";
import type { CategoryNode, MegaMenuRoot } from "@/lib/categories";

// جستجو + دسته‌بندی روی موبایل. روی دسکتاپ همین قابلیت‌ها توی هدر (SearchBox
// و CategoryMegaMenu) هستن؛ این نسخه فقط برای ارسال‌های md و کوچک‌تر با ظاهر
// مناسب تاچ: جستجو زیر ردیف اصلی، و دکمه‌ای که لیست دسته‌بندی‌ها رو باز/بسته می‌کنه.
export function MobileMenu({
  categories,
  genderGroups,
  externalSites = [],
  activeMarketplaceSlug = null,
}: {
  categories: CategoryNode[];
  genderGroups?: MegaMenuRoot[];
  externalSites?: { id: string; name: string; slug: string }[];
  activeMarketplaceSlug?: "mazon" | string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonWrapRef = useRef<HTMLDivElement>(null);
  // موقعیتِ واقعیِ صفحه‌ی دکمه -- چون فلای‌اوت با پورتال مستقیم زیرِ <body>
  // می‌ره (نه زیرِ همین wrapper)، دیگه با absolute/top-full جاش پیدا نمی‌شه؛
  // خودمون با getBoundingClientRect حساب می‌کنیم و fixed می‌ذاریم
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  // چرا پورتال: هدر (Header.tsx) و نوارِ سورت/فیلترِ صفحه‌ی مارکت‌پلیس
  // (marketplaces/[slug]/page.tsx) هردو sticky با z-index برابرن (هرکدوم
  // استکینگ-کانتکستِ جدا می‌سازه) -- طبقِ قاعده‌ی CSS، هرکدوم بعداً توی DOM
  // بیاد (نوارِ فیلتر) روی اون یکی می‌شینه، حتی اگه فلای‌اوتِ داخلِ هدر
  // z-index بالاتری داشته باشه (چون z-index داخلی محدود به همون
  // استکینگ-کانتکستِ هدره، نمی‌تونه از سیبلینگِ هم‌سطح رد بشه). با پورتال به
  // document.body، این فلای‌اوت دیگه اصلاً داخلِ استکینگ-کانتکستِ هدر نیست
  useEffect(() => {
    if (!open) return;
    function updatePos() {
      const rect = buttonWrapRef.current?.getBoundingClientRect();
      if (rect) setPanelPos({ top: rect.bottom + 8, left: rect.left });
    }
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open]);

  const currentSiteSlug = pathname.match(/^\/marketplaces\/([^/]+)/)?.[1] ?? null;
  const isTrendyolContext = currentSiteSlug !== null;
  const baseHref = isTrendyolContext ? `/marketplaces/${currentSiteSlug}` : "/products";
  const categoryParam = isTrendyolContext ? "category" : "categories";
  const topBarCategories = categories.filter((c) => c.slug !== "clothing");

  // توی مارکت‌پلیس‌های ترندیول/میلا، genderGroups (که از کاتالوگِ محلیِ مزون
  // ساخته می‌شه، نه ترندیول) تقریباً همیشه خالیه -- قبلاً همین باعث می‌شد این
  // منو تا ابد «در حال بارگذاری...» بمونه (هیچ فچی هم برای پُرشدنش نبود).
  // دقیقاً مثلِ CategoryMegaMenuِ دسکتاپ، اینجا هم درختِ زنده‌ی ۱۰ بخشِ اصلیِ
  // ترندیول رو واکشی می‌کنیم
  const [trendyolRoots, setTrendyolRoots] = useState<MegaMenuRoot[] | null>(null);
  useEffect(() => {
    if (!isTrendyolContext || trendyolRoots !== null) return;
    let cancelled = false;
    fetch(`/api/marketplaces/${currentSiteSlug}/trendyol-categories/tree`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTrendyolRoots(data.roots ?? []);
      })
      .catch(() => {
        if (!cancelled) setTrendyolRoots([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTrendyolContext, currentSiteSlug]);

  const panelRoots: MegaMenuRoot[] = isTrendyolContext
    ? (trendyolRoots ?? [])
    : [...(genderGroups ?? []), ...topBarCategories];

  return (
    <div className="lg:hidden px-4 pb-3 flex items-center gap-2">
      <SearchBox mobile />

      <div className="relative shrink-0" ref={buttonWrapRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full border cut-line text-sm font-medium transition-colors ${
            open ? "bg-[var(--color-wine)] text-white" : "bg-white hover:bg-[var(--color-linen-dim)]"
          }`}
        >
          <span>☰</span>
          <span>دسته‌بندی</span>
        </button>

        {open &&
          panelPos &&
          createPortal(
            <div
              className="fixed w-64 max-h-[70vh] overflow-y-auto bg-white border cut-line rounded-lg shadow-xl z-50"
              style={{ top: panelPos.top, left: panelPos.left }}
              onClick={() => setOpen(false)}
            >
              {/* سوییچِ سریعِ سایت -- طبقِ درخواستِ صریح: توی موبایل هیچ‌جا لینکِ
                  مزون/ترندیول/میلا همیشه در دسترس نبود، کاربر مجبور بود اول برگرده
                  صفحه‌ی اول. همینجا (که با دکمه‌ی «دسته‌بندی» از هر صفحه‌ای در
                  دسترسه) رو هرسه رو یه‌جا می‌ذاریم */}
              <ul className="py-2 text-sm border-b cut-line">
                <li>
                  <Link
                    href="/"
                    className={`block px-4 py-2 font-bold ${
                      activeMarketplaceSlug === "mazon"
                        ? "text-[var(--color-wine)]"
                        : "hover:text-[var(--color-wine)]"
                    }`}
                  >
                    ✦ موجود در مزون
                  </Link>
                </li>
                {externalSites.map((site) => (
                  <li key={site.id}>
                    <Link
                      href={`/marketplaces/${site.slug}`}
                      className={`block px-4 py-2 font-bold ${
                        activeMarketplaceSlug === site.slug
                          ? "text-[var(--color-wine)]"
                          : "hover:text-[var(--color-wine)]"
                      }`}
                    >
                      {site.name}
                    </Link>
                  </li>
                ))}
              </ul>
              {panelRoots.length === 0 && (
                <p className="p-3 text-xs text-[var(--color-muted)]">در حال بارگذاری دسته‌بندی‌ها...</p>
              )}
              <ul className="py-2 text-sm">
                {panelRoots.map((root) => {
                  const href = root.attrsQuery
                    ? `${baseHref}?attrs=${encodeURIComponent(root.attrsQuery)}`
                    : `${baseHref}?${categoryParam}=${root.slug}`;
                  return (
                    <li key={root.id}>
                      <Link
                        href={href}
                        className="block px-4 py-2.5 hover:bg-[var(--color-linen-dim)] font-medium"
                      >
                        {root.name}
                      </Link>
                      {root.children.length > 0 && (
                        <ul>
                          {root.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`${baseHref}?${categoryParam}=${child.slug}`}
                                className="block px-6 py-1.5 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-wine)]"
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}

export function MobileMenuSuspense(props: {
  categories: CategoryNode[];
  genderGroups?: MegaMenuRoot[];
  externalSites?: { id: string; name: string; slug: string }[];
  activeMarketplaceSlug?: "mazon" | string | null;
}) {
  return (
    <Suspense fallback={null}>
      <MobileMenu {...props} />
    </Suspense>
  );
}
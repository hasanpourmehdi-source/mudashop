"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { CategoryNode, MegaMenuRoot } from "@/lib/categories";
import { CategoryMegaPanel, type CategoryMegaPanelHandle } from "@/components/CategoryMegaPanel";

export function CategoryMegaMenu({
  categories,
  genderGroups = [],
}: {
  categories: CategoryNode[];
  genderGroups?: MegaMenuRoot[];
  externalSites?: { id: string; name: string; slug: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panelRef = useRef<CategoryMegaPanelHandle>(null);
  // دسته‌بندی‌های خام و زنده‌ی ترندیول (هر ۱۰ بخش اصلی + زیرشاخه‌هاشون) -- دقیقاً
  // همون درختی که فیلتر سایدبار سایت خارجی نشون می‌ده
  const [trendyolRoots, setTrendyolRoots] = useState<MegaMenuRoot[] | null>(null);

  // منوی افقی «مال همون سایتیه» که کاربر توش هست -- توی صفحات هر مارکت‌پلیس
  // (چه گرید /marketplaces/[slug] چه صفحه‌ی جزئیات محصول ترندیول)، لینک‌ها
  // باید به فیلترهای همون سایت برن، نه یه سایت خارجی دیگه یا /products مزون.
  // اسلاگ سایت جاری از خودِ مسیر استخراج می‌شه (نه یه رشته‌ی ثابت "trendyol")
  // تا برای هر مارکت‌پلیسی (ترندیول، میلا، ...) درست کار کنه
  const marketplaceSlugMatch = pathname.match(/^\/marketplaces\/([^/]+)/);
  const currentSiteSlug = marketplaceSlugMatch
    ? marketplaceSlugMatch[1]
    : pathname.startsWith("/products/trendyol")
      ? "trendyol"
      : null;
  const isTrendyolContext = currentSiteSlug !== null;

  // چندتا آیدی می‌تونن با کاما توی یه param واحد بیان (مثلاً "wc=117,114") -- ولی
  // خودِ attrs توی URL هم چندتا توکن رو با کاما جدا می‌کنه، پس این کاماهای داخلی
  // باید قبل از قرار گرفتن توی توکن با _ جایگزین بشن (جزئیات کامل توی
  // src/lib/externalSites.ts کنار encodeTrendyolCategoryParam)
  function decodeTrendyolCategoryParam(encoded: string): string {
    return encoded.replace(/_/g, ",");
  }

  // بخش اصلیِ واقعی (اسم ترکی) که دسته‌بندی خامِ فعلاً انتخاب‌شده واقعاً زیرش
  // قرار داره -- برای تشخیص تب فعال. چرا این باید جدا از یه اسکن ساده‌ی درخت
  // باشه: خیلی از wc=های ترندیول بین چندتا بخش اصلی مشترکن (مثلاً همون wc=
  // هم زیر «زنانه» هم زیر «مادر و کودک» هست)، پس فقط چک کردن «آیا این پارامتر
  // جایی زیر این ریشه هست» باعث می‌شه چندتا تب هم‌زمان به‌اشتباه فعال نشون
  // داده بشن. به‌جاش از همون endpoint سایدبار (resolveParam) که مسیر واقعی و
  // یکتای این پارامتر رو برمی‌گردونه استفاده می‌کنیم
  const [resolvedTopSection, setResolvedTopSection] = useState<string | null>(null);

  // درخت خام ترندیول فقط یه‌بار (وقتی اولین‌بار وارد کانتکست مارکت‌پلیس می‌شیم)
  // گرفته می‌شه -- مستقل از سایتِ خاص، چون TrendyolCategoryCache بین
  // ترندیول/میلا مشترکه (دقیقاً همون داده‌ای که فیلتر سایدبار هم استفاده می‌کنه)
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
  }, [isTrendyolContext]);

  const currentAttrs = searchParams.get("attrs")?.split(",").filter(Boolean) ?? [];
  // برای فعال‌بودنِ هرکدوم از ۱۰ تبِ ترندیول: یا توکن جنسیت خودِ همون ریشه
  // (Kadın/Erkek) انتخاب شده، یا دسته‌بندی خامِ فعلی زیر همین ریشه‌ست
  const currentRawCategoryParam = currentAttrs
    .find((t) => t.startsWith("__trendyolCategory~"))
    ?.slice("__trendyolCategory~".length);

  // مسیر واقعی (و یکتای) دسته‌بندی خامِ فعلی رو از همون endpoint سایدبار می‌گیریم
  useEffect(() => {
    if (!currentRawCategoryParam) {
      setResolvedTopSection(null);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/marketplaces/${currentSiteSlug}/trendyol-categories?resolveParam=${encodeURIComponent(
        decodeTrendyolCategoryParam(currentRawCategoryParam)
      )}`
    )
      .then((res) => res.json())
      .then((data: { topSection: string | null }) => {
        if (!cancelled) setResolvedTopSection(data.topSection ?? null);
      })
      .catch(() => {
        if (!cancelled) setResolvedTopSection(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentRawCategoryParam, currentSiteSlug]);

  if (categories.length === 0) return null;

  const baseHref = isTrendyolContext ? `/marketplaces/${currentSiteSlug}` : "/products";
  // آدرس مزون از پارامتر جمع «categories» (چندتایی) استفاده می‌کنه، ولی
  // صفحه‌ی هر مارکت‌پلیس از «category» (تکی) -- دقیقاً همون قراردادی که
  // خودِ صفحه‌ی /marketplaces/[slug] از قبل انتظارش رو داره (فقط برای لینک‌های
  // نوار تخت که همچنان دسته‌بندی‌های کیوریت‌شده‌ی مزون رو نشون می‌دن)
  const categoryParam = isTrendyolContext ? "category" : "categories";

  // «پوشاک» توی این نوار تخت نشون داده نمی‌شه چون محتواش از طریق تب‌های
  // «زنانه»/«مردانه» در دسترسه -- دقیقاً مثل ترندیول که «Giyim» رو کنار
  // Kadın/Erkek نمی‌ذاره.
  const topBarCategories = categories.filter((c) => c.slug !== "clothing");

  // توی مارکت‌پلیس‌های ترندیول/میلا، هم نوار افقی هم منوی کشویی «☰ دسته‌بندی‌ها»
  // فقط درخت زنده‌ی ۱۰ بخش اصلی ترندیول رو نشون می‌دن (دقیقاً مثل فیلتر سایدبار
  // خودِ همون صفحه) -- دسته‌بندی‌های کیوریت‌شده‌ی مزون (کفش/اکسسوری/...) دیگه
  // این‌جا نمیان چون با معادل واقعی‌شون (Ayakkabı & Çanta و ...) تکراری/ناهمگون می‌شن.
  // تا وقتی درخت لود بشه، خالی می‌مونه
  const panelRoots: MegaMenuRoot[] = isTrendyolContext ? trendyolRoots ?? [] : [...genderGroups, ...topBarCategories];

  // فعال بودن این تب‌ها فقط وقتی معنی داره که دقیقاً توی همون صفحه‌ی مرجع
  // همین سایت باشیم (mazon: /products، هر مارکت‌پلیس: /marketplaces/همون-اسلاگ)
  // و همون فیلتر دقیقاً انتخاب‌شده باشه
  const isFilterablePage = isTrendyolContext ? pathname.startsWith(baseHref) : pathname === "/products";
  const currentCategories = isTrendyolContext
    ? (searchParams.get("category") ? [searchParams.get("category")!] : [])
    : (searchParams.get("categories")?.split(",").filter(Boolean) ?? []);
  // فعال‌بودن هر ریشه: ریشه‌های جنسیتی (Kadın/Erkek) فقط با توکن attrs=جنسیت~...
  // خودشون فعال می‌شن. ریشه‌های غیرجنسیتی از روی مسیر واقعیِ resolveParam فعال
  // می‌شن -- ولی فقط وقتی هیچ توکن جنسیتی‌ای فعال نباشه؛ چون خیلی از wc=ها بین
  // یه بخش جنسیتی و یکی از ۸ بخش دیگه مشترکن (مثلاً هم زیر «زنانه» هم زیر
  // «مادر و کودک»)، و اگه توکن جنسیت همراهش ست شده، یعنی مطمئناً از همون بخش
  // جنسیتی انتخاب شده -- نه از resolveParam که فقط یه مسیر دلخواه از بین
  // مسیرهای مشترک برمی‌گردونه
  const hasGenderToken = currentAttrs.some((t) => t.startsWith("جنسیت~"));
  function isTrendyolRootActive(root: MegaMenuRoot): boolean {
    if (root.attrsQuery) return currentAttrs.includes(root.attrsQuery);
    if (hasGenderToken) return false;
    return resolvedTopSection !== null && root.slug === `__section-${resolvedTopSection}`;
  }

  return (
    <nav className="hidden lg:block border-t cut-line">
      <ul className="max-w-[1600px] mx-auto px-4 flex items-center gap-1 text-sm font-medium">
        <li>
          <CategoryMegaPanel ref={panelRef} categories={panelRoots} baseHref={baseHref} categoryParam={categoryParam} />
        </li>
        <li className="w-px h-5 bg-[var(--color-line)] mx-1" aria-hidden />
        {isTrendyolContext ? (
          // هر ۱۰ بخش اصلی ترندیول به‌صورت تب جدا -- کلیک روی هرکدوم مستقیم
          // فیلتر می‌کنه (بدون باز شدن پنل کشویی ☰): بخش‌های جنسیتی (Kadın/Erkek)
          // توکن attrs=جنسیت~... دارن؛ بقیه‌ی ۸ بخش توکن
          // attrs=__trendyolCategory~wc=<rootWc همون بخش، از trendyolTopSections.ts>
          // دارن -- مستقیم محصولات کل بخش رو نشون می‌ده، دقیقاً مثل کلیک روی
          // خودِ نوار بالای ترندیول. فقط اگه یه بخش هیچ rootWc نداشته باشه
          // (نباید پیش بیاد، ولی fallback امن)، به ?section= (سایدبار) برمی‌گرده
          panelRoots.map((root) => {
            const isActive = isFilterablePage && isTrendyolRootActive(root);
            const turkishSection = root.slug.startsWith("__section-") ? root.slug.slice("__section-".length) : null;
            const href = root.attrsQuery
              ? `${baseHref}?attrs=${encodeURIComponent(root.attrsQuery)}`
              : turkishSection
                ? `${baseHref}?section=${encodeURIComponent(turkishSection)}`
                : baseHref;
            return (
              <li key={root.id}>
                <Link
                  href={href}
                  className={`block px-3 py-2.5 transition-colors ${
                    isActive ? "text-[var(--color-wine)] font-semibold" : "hover:text-[var(--color-wine)]"
                  }`}
                >
                  {root.name}
                </Link>
              </li>
            );
          })
        ) : (
          <>
            {/* جنسیت یک Category نیست، یه فیلتر مستقله -- برای همین این دو تب جدا از حلقه‌ی
                دسته‌بندی‌ها اضافه شدن، دقیقاً مثل Kadın/Erkek توی ترندیول */}
            {(["زنانه", "مردانه"] as const).map((gender) => {
              const isActive = isFilterablePage && currentAttrs.includes(`جنسیت~${gender}`);
              return (
                <li key={gender}>
                  <Link
                    href={`${baseHref}?attrs=${encodeURIComponent(`جنسیت~${gender}`)}`}
                    className={`block px-3 py-2.5 transition-colors font-semibold ${
                      isActive ? "text-[var(--color-wine)]" : "hover:text-[var(--color-wine)]"
                    }`}
                  >
                    {gender}
                  </Link>
                </li>
              );
            })}
            <li className="w-px h-5 bg-[var(--color-line)] mx-1" aria-hidden />
            {topBarCategories.map((root) => {
              const isActive = isFilterablePage && currentCategories.includes(root.slug);
              return (
                <li key={root.id}>
                  <Link
                    href={`${baseHref}?${categoryParam}=${root.slug}`}
                    className={`block px-3 py-2.5 transition-colors ${
                      isActive ? "text-[var(--color-wine)] font-semibold" : "hover:text-[var(--color-wine)]"
                    }`}
                  >
                    {root.name}
                  </Link>
                </li>
              );
            })}
          </>
        )}
      </ul>
    </nav>
  );
}

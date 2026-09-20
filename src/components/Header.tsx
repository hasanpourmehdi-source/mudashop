"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/hooks/useCart";
import { useSalesPaused } from "@/components/SalesPausedProvider";
import { SearchBox } from "@/components/SearchBox";
import { CategoryMegaMenu } from "@/components/CategoryMegaMenu";
import { MobileMenuSuspense } from "@/components/MobileMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { LoyaltyTierBadge } from "@/components/LoyaltyTierBadge";
import { MessageLink } from "@/components/MessageLink";
import { LanguageToggle } from "@/components/LanguageToggle";
import { InstallAppButton } from "@/components/InstallAppButton";
import { useLang } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import { useCurrentMarketplaceStore } from "@/store/currentMarketplace";
import type { CategoryNode, MegaMenuRoot } from "@/lib/categories";

export function Header({
  categories = [],
  genderGroups = [],
  externalSites = [],
}: {
  categories?: CategoryNode[];
  genderGroups?: MegaMenuRoot[];
  externalSites?: { id: string; name: string; slug: string }[];
}) {
  const { data: session, status } = useSession();
  const { items } = useCart();
  const { paused: salesPaused } = useSalesPaused();
  const { lang } = useLang();
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const pathname = usePathname();
  // چون /products/trendyol/[slug] برای هم خودِ ترندیول و هم ترندیول‌میلا مشترکه
  // و از روی pathname قابل‌تشخیص نیست، خودِ صفحه‌ی محصول (CurrentMarketplaceSync)
  // این مقدار رو موقعِ mount ست می‌کنه تا هدر بدونه دقیقاً مالِ کدوم سایته
  const currentProductSiteSlug = useCurrentMarketplaceStore((s) => s.siteSlug);

  // صفحه‌ی جزئیات محصول ترندیول (/products/trendyol/[slug]) هم بخشی از «ترندیول»
  // حساب می‌شه، نه «موجود در مزون» -- با اینکه زیر مسیر /marketplaces نیست
  const isTrendyolProductPage = pathname.startsWith("/products/trendyol");

  // «موجود در مزون» یعنی فضای اصلی سایت (خونه، محصولات، ...) نه هیچ‌کدوم از
  // سایت‌های خارجی -- وقتی کاربر داخل /marketplaces/... یا صفحه‌ی محصول
  // ترندیول هست، این لینک دیگه فعال نیست
  const isMazonActive = !pathname.startsWith("/marketplaces") && !isTrendyolProductPage;

  // اسلاگِ دقیقِ سایتِ خارجیِ جاری (نه startsWith) -- چون یه اسلاگ می‌تونه
  // پیشوند یه اسلاگ دیگه باشه (مثلاً "trendyol" پیشوند "trendyol-milla"ست)؛
  // startsWith روی مسیر باعث می‌شد توی "/marketplaces/trendyol-milla" هم لینک
  // «ترندیول» رنگی بمونه
  const currentMarketplaceSlug = pathname.match(/^\/marketplaces\/([^/]+)/)?.[1] ?? null;

  // برای منوی موبایل -- همون منطقِ isActive بالا (خطِ ~۱۲۷)، فقط یه‌بار جمع‌شده
  // به یه مقدارِ ساده، چون MobileMenu نمی‌خواد useCurrentMarketplaceStore رو
  // دوباره صدا بزنه یا کل این محاسبه رو تکرار کنه
  const activeMarketplaceSlug: "mazon" | string | null = isMazonActive
    ? "mazon"
    : (currentMarketplaceSlug ??
      (isTrendyolProductPage ? (currentProductSiteSlug ?? "trendyol") : null));

  // توی پنل ادمین جستجوی محصول و منوی دسته‌بندی‌های افقی معنی ندارن -- این
  // بخش‌ها مخصوص گشت‌وگذار توی فروشگاهه، نه مدیریت
  const isAdminPage = pathname.startsWith("/admin");

  // منوی دسته‌بندی‌های افقی -- با اسکرول به پایین (بعد از رد شدن از ارتفاع
  // نوار بالا+ردیف اصلی) جمع می‌شه، و با اسکرول به بالا (از هر جای صفحه، نه
  // فقط نزدیک بالای صفحه) دوباره باز می‌شه. چون این بخش داخل همون کانتینر
  // چسبناک (sticky) قرار می‌گیره، جمع‌شدنش هیچ فضای خالی نمی‌ذاره -- ارتفاع
  // کل باکس چسبناک کم می‌شه و محتوای زیرش خودکار جاش رو پر می‌کنه
  const [menuVisible, setMenuVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      // جمع‌وجورشدن نوار بالا+منو خودش ارتفاع هدر رو کم می‌کنه؛ چون هدر
      // چسبناکه، این تغییر ارتفاع می‌تونه باعث بشه مرورگر (scroll anchoring)
      // موقعیت اسکرول رو کمی خودکار جبران کنه -- همون چند پیکسل جبرانی اگه
      // مستقیم به این هندلر برسه، جهت اسکرول رو برعکس نشون می‌ده و باعث
      // می‌شه هدر مدام باز/بسته بشه (لرزش) درست دور همون آستانه‌ی ۱۳۰.
      // برای همین فقط بعد از یه جابه‌جایی معنادار (بیشتر از چند پیکسل) واکنش
      // نشون می‌دیم، نه به هر نوسان ریزی
      if (Math.abs(delta) < 8) return;
      const goingDown = delta > 0;
      const pastTopBar = currentY > 130; // تقریباً ارتفاع نوار نازک + ردیف اصلی
      if (goingDown && pastTopBar) {
        setMenuVisible(false);
      } else {
        setMenuVisible(true);
      }
      lastScrollY.current = currentY;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    // نوار نازک بالایی + ردیف اصلی (لوگو/جستجو) + منوی دسته‌بندی -- همه با هم
    // چسبناکن (sticky مستقیم روی خودِ <header>، نه یه div اضافه داخلش --
    // چون کانتینینگ‌بلاکِ چسبناک، همون والدشه؛ اگه یه div اضافه فقط برای
    // wrap کردن اضافه بشه، ارتفاع اون والد دقیقاً برابر همین محتوا می‌شه و
    // چسبناک بعد از رد شدن از همون ارتفاع کم دیگه جایی برای موندن نداره و از
    // صفحه خارج می‌شه. با چسبناک بودن خودِ header، والدش body می‌شه که کل
    // صفحه رو در بر می‌گیره). با اسکرول به پایین، فقط منوی دسته‌بندی جمع می‌شه
    // (پایین‌تر همین کد)؛ با اسکرول به بالا (از هر جای صفحه) دوباره باز می‌شه.
    // نوار نازکِ بالایی (شاملِ سوییچِ سریعِ مزون/ترندیول/میلا) و ردیف اصلی
    // (لوگو/جستجو/آیکون‌ها) همیشه سرجاشون می‌مونن -- تا وسطِ اسکرول گم نشن
    <header
      className="sticky top-0 z-30 bg-[var(--color-linen)]/95 backdrop-blur border-b cut-line"
      style={{ overflowAnchor: "none" }}
    >
        {/* نوار نازک بالایی -- لینک‌های کم‌کاربردتر + سوییچِ سریعِ مزون/ترندیول/میلا.
            عمداً دیگه با اسکرول جمع نمی‌شه (برخلافِ قبل) -- چون همون سوییچِ
            سریعِ مارکت‌پلیس این‌جاست، و وسطِ اسکرول گم‌شدنش یعنی کاربر برای
            عوض‌کردنِ سایت باید برگرده بالای صفحه. فقط منوی دسته‌بندیِ زیرش
            (پایین‌تر همین کد) با اسکرول جمع می‌شه */}
        <div className="hidden md:block">
          <div className="bg-[var(--color-ink)] text-white">
            <div className="max-w-[1600px] mx-auto px-4 h-9 flex items-center justify-between text-xs">
              <div className="flex items-center gap-5">
                <Link
                  href="/"
                  className={`transition-colors ${
                    isMazonActive
                      ? "text-[var(--color-ochre)] font-bold"
                      : "hover:text-[var(--color-ochre)]"
                  }`}
                >
                  {t(lang, "mazon")}
                </Link>
                {externalSites.map((site) => {
                  const isActive =
                    currentMarketplaceSlug === site.slug ||
                    (isTrendyolProductPage &&
                      (currentProductSiteSlug
                        ? currentProductSiteSlug === site.slug
                        : site.slug === "trendyol"));
                  return (
                    <Link
                      key={site.id}
                      href={`/marketplaces/${site.slug}`}
                      className={`transition-colors ${
                        isActive ? "text-[var(--color-ochre)] font-bold" : "hover:text-[var(--color-ochre)]"
                      }`}
                    >
                      {site.name}
                    </Link>
                  );
                })}
              </div>
              <div className="flex items-center gap-5">
                {status === "authenticated" && (
                  <>
                    <Link
                      href="/wallet"
                      className={`transition-colors ${
                        pathname.startsWith("/wallet")
                          ? "text-[var(--color-ochre)] font-bold"
                          : "hover:text-[var(--color-ochre)]"
                      }`}
                    >
                      {t(lang, "wallet")}
                    </Link>
                    <Link
                      href="/orders"
                      className={`transition-colors ${
                        pathname.startsWith("/orders")
                          ? "text-[var(--color-ochre)] font-bold"
                          : "hover:text-[var(--color-ochre)]"
                      }`}
                    >
                      {t(lang, "myOrders")}
                    </Link>
                    <MessageLink admin={session.user.role === "ADMIN"} />
                    {session.user.role === "ADMIN" && (
                      <Link
                        href="/admin"
                        className={`transition-colors ${
                          pathname.startsWith("/admin")
                            ? "text-[var(--color-ochre)] font-bold"
                            : "hover:text-[var(--color-ochre)]"
                        }`}
                      >
                        {t(lang, "adminPanel")}
                      </Link>
                    )}
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="hover:text-[var(--color-ochre)] transition-colors"
                    >
                      {t(lang, "logout")}
                    </button>
                  </>
                )}
                <LanguageToggle />
                <InstallAppButton className="hover:text-[var(--color-ochre)] transition-colors text-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* نوار اصلی -- لوگو، جستجوی بزرگ، و آیکون‌های حساب کاربری -- همیشه سرجاش می‌مونه */}
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between gap-6">
          <Link href="/" className="text-2xl font-extrabold text-[var(--color-wine)] tracking-tight shrink-0">
            مُداشاپ
          </Link>

          {!isAdminPage && <SearchBox />}

          <div className="flex items-center gap-5 text-[11px] font-medium shrink-0">
            <NotificationBell />

            {status === "authenticated" ? (
              <Link
                href="/profile"
                className="flex flex-col items-center gap-0.5 hover:text-[var(--color-wine)] transition-colors"
              >
                <span className="text-lg leading-none">👤</span>
                <span className="flex items-center gap-1">
                  {session.user?.name?.split(" ")[0] ?? t(lang, "profile")}
                  <LoyaltyTierBadge variant="icon" />
                </span>
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="flex flex-col items-center gap-0.5 hover:text-[var(--color-wine)] transition-colors"
              >
                <span className="text-lg leading-none">👤</span>
                {t(lang, "login")}
              </Link>
            )}

            <Link
              href="/wishlist"
              className="flex flex-col items-center gap-0.5 hover:text-[var(--color-wine)] transition-colors"
            >
              <span className="text-lg leading-none">♡</span>
              {t(lang, "wishlist")}
            </Link>

            {!salesPaused && (
              <Link
                href="/cart"
                className="relative flex flex-col items-center gap-0.5 hover:text-[var(--color-wine)] transition-colors"
              >
                <span className="text-lg leading-none">🛒</span>
                {t(lang, "cart")}
                {cartCount > 0 && (
                  <span className="absolute -top-1 -left-3 bg-[var(--color-wine)] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* جستجو + دسته‌بندی موبایل -- فقط در اندازه‌های md و کوچک‌تر */}
        {!isAdminPage && (
          <MobileMenuSuspense
            categories={categories}
            genderGroups={genderGroups}
            externalSites={externalSites}
            activeMarketplaceSlug={activeMarketplaceSlug}
          />
        )}

        {/* منوی دسته‌بندی‌های افقی -- عمداً داخل همون div چسبناک بالاست (نه
            بیرونش)، تا جمع‌شدنش با اسکرول به پایین هیچ فضای خالی نذاره -- فقط
            ارتفاع خودِ باکس چسبناک کم می‌شه */}
        {!isAdminPage && (
          <div
            className={`transition-[max-height] duration-300 ease-in-out ${menuVisible ? "overflow-visible" : "overflow-hidden"}`}
            style={{ maxHeight: menuVisible ? "48px" : "0px" }}
          >
            <Suspense fallback={null}>
              <CategoryMegaMenu categories={categories} genderGroups={genderGroups} externalSites={externalSites} />
            </Suspense>
          </div>
        )}
    </header>
  );
}

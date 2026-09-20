"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCart } from "@/hooks/useCart";
import { useSalesPaused } from "@/components/SalesPausedProvider";

// ناوبریِ پایینِ موبایل (اپ‌مانند) -- طبقِ نظرِ خودم که مهدی خواست انجامش بدم:
// ردیفِ آیکن‌های بالای هدر توی موبایل شلوغ/جمع‌وجوره؛ یه نوارِ پایینیِ ثابت با
// انگشتِ شست راحت‌تر در دسترسه، دقیقاً مثلِ اپ‌های واقعیِ فروشگاهی. فقط زیرِ md
// دیده می‌شه -- دسکتاپ دست‌نخورده می‌مونه. توی پنلِ ادمین اصلاً نشون داده نمی‌شه
const ITEMS = [
  { href: "/", label: "خانه", icon: "🏠" },
  { href: "/products", label: "دسته‌بندی", icon: "🗂️" },
  { href: "/cart", label: "سبد", icon: "🛒" },
  { href: "/profile", label: "من", icon: "👤" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const { status } = useSession();
  const { items } = useCart();
  const { paused: salesPaused } = useSalesPaused();
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  if (pathname.startsWith("/admin") || pathname.startsWith("/auth") || pathname.startsWith("/staff")) return null;

  // فروش که متوقفه، سبد اصلاً معنی نداره -- «فقط-نمایش» یعنی واقعاً هیچ‌جا رد
  // پایی از خرید نمونه، نه فقط دکمه‌ی خرید
  const visibleItems = salesPaused ? ITEMS.filter((item) => item.href !== "/cart") : ITEMS;

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--color-linen)]/95 backdrop-blur border-t cut-line flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {visibleItems.map((item) => {
          const href = item.href === "/profile" && status !== "authenticated" ? "/auth/login" : item.href;
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] transition-colors ${
                isActive ? "text-[var(--color-wine)] font-bold" : "text-[var(--color-muted)]"
              }`}
            >
              <span className="relative text-lg leading-none">
                {item.icon}
                {item.href === "/cart" && cartCount > 0 && (
                  <span className="absolute -top-1.5 -left-2.5 bg-[var(--color-wine)] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                    {cartCount > 9 ? "۹+" : cartCount.toLocaleString("fa-IR")}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {/* اسپیسرِ غیرِ fixed -- چون خودِ نوارِ بالا fixed ه و فضایی توی جریانِ
          صفحه نمی‌گیره، بدونِ این، پایینِ فوتر همیشه زیرِ نوار قایم می‌شه.
          فقط وقتی رندر می‌شه که خودِ نوار هم نشون داده می‌شه (همون شرطِ بالا) */}
      <div className="md:hidden h-14" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-hidden="true" />
    </>
  );
}

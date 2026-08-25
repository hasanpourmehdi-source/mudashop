"use client";

import { Suspense, useState } from "react";
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
}: {
  categories: CategoryNode[];
  genderGroups?: MegaMenuRoot[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const currentSiteSlug = pathname.match(/^\/marketplaces\/([^/]+)/)?.[1] ?? null;
  const isTrendyolContext = currentSiteSlug !== null;
  const baseHref = isTrendyolContext ? `/marketplaces/${currentSiteSlug}` : "/products";
  const categoryParam = isTrendyolContext ? "category" : "categories";
  const topBarCategories = categories.filter((c) => c.slug !== "clothing");
  const panelRoots: MegaMenuRoot[] = isTrendyolContext
    ? (genderGroups ?? [])
    : [...(genderGroups ?? []), ...topBarCategories];

  return (
    <div className="lg:hidden px-4 pb-3 flex items-center gap-2">
      <SearchBox mobile />

      <div className="relative shrink-0">
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

        {open && (
          <div
            className="absolute top-full left-0 mt-2 w-64 max-h-[70vh] overflow-y-auto bg-white border cut-line rounded-lg shadow-xl z-40"
            onClick={() => setOpen(false)}
          >
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
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileMenuSuspense(props: {
  categories: CategoryNode[];
  genderGroups?: MegaMenuRoot[];
}) {
  return (
    <Suspense fallback={null}>
      <MobileMenu {...props} />
    </Suspense>
  );
}
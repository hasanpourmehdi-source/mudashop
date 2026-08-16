"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { MegaMenuRoot } from "@/lib/categories";
import { categoryIcon } from "@/lib/categoryIcon";

const MAX_ITEMS_PER_COLUMN = 5;
const MAX_ROOT_ITEMS_VISIBLE = 8; // اگه دسته‌بندی‌های ریشه بیشتر از این تعداد بودن، بقیه پشت «نمایش بیشتر» می‌رن

// پیشوند توکن دسته‌بندی خامِ ترندیول توی attrs -- باید دقیقاً با
// TRENDYOL_RAW_CATEGORY_ATTR توی src/components/ExternalSiteFilters.tsx یکی
// باشه (اونجا هم به همون دلیل جدا تعریف شده: نمی‌شه از externalSites.ts
// سمت سرور مستقیم توی کامپوننت کلاینتی ایمپورت کرد)
const TRENDYOL_RAW_CATEGORY_ATTR = "__trendyolCategory";

// چندتا آیدی می‌تونن با کاما توی یه param واحد بیان (مثلاً "wc=117,114") -- ولی
// خودِ attrs توی URL هم چندتا توکن رو با کاما جدا می‌کنه، پس این کاماهای داخلی
// باید قبل از قرار گرفتن توی توکن با _ جایگزین بشن (جزئیات کامل توی
// src/lib/externalSites.ts کنار encodeTrendyolCategoryParam)
function encodeTrendyolCategoryParam(param: string): string {
  return param.replace(/,/g, "_");
}

export type CategoryMegaPanelHandle = {
  openWithRoot: (rootId: string) => void;
  close: () => void;
};

// forwardRef شد تا وقتی این پنل توی کانتکست ترندیول با ۱۰ تب جدا (نوار افقی)
// همراهه، هاور روی هرکدوم از اون تب‌ها بتونه همین یه پنل مشترک رو با ریشه‌ی
// مربوطه باز کنه -- نه این‌که هر تب پاپ‌آپ جدای خودش رو داشته باشه
export const CategoryMegaPanel = forwardRef<CategoryMegaPanelHandle, {
  categories: MegaMenuRoot[];
  baseHref?: string;
  categoryParam?: string;
}>(function CategoryMegaPanel({ categories, baseHref = "/products", categoryParam = "categories" }, ref) {
  const [open, setOpen] = useState(false);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [showAllRoots, setShowAllRoots] = useState(false);

  useImperativeHandle(ref, () => ({
    openWithRoot: (rootId: string) => {
      setActiveRootId(rootId);
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  if (categories.length === 0) return null;

  const activeRoot = categories.find((c) => c.id === activeRootId) ?? categories[0];
  // اگه ریشه‌ی فعال یه گروه جنسیتیه (زنانه/مردانه)، این query باید به همه‌ی
  // لینک‌های زیرمجموعه‌اش اضافه بشه تا هم دسته‌بندی هم جنسیت با هم فیلتر بشن
  const extraQuery = activeRoot.attrsQuery ? `&attrs=${encodeURIComponent(activeRoot.attrsQuery)}` : "";

  // ساخت لینک هر گره: بعضی ریشه‌ها (مثلاً دسته‌بندی‌های خام و زنده‌ی ترندیول --
  // زنانه/مردانه) به‌جای querystring مزون (categories=slug)، باید دقیقاً همون
  // توکن attrs ترکیبی (جنسیت + دسته‌بندی خام) رو بسازن که سایدبار فیلتر سایت
  // خارجی موقع تیک‌زدن می‌سازه -- یه attrs واحد، نه دوتا attrs جدا. این تصمیم
  // به‌ازای هر ریشه جداگونه‌ست (activeRoot.rawCategoryLinks)، نه کل پنل -- چون
  // یه پنل واحد می‌تونه هم ریشه‌های خام ترندیول هم ریشه‌های کیوریت‌شده‌ی مزون
  // (اکسسوری/کفش/...) رو با هم داشته باشه
  function hrefFor(slug: string): string {
    if (activeRoot.rawCategoryLinks) {
      const tokens = [activeRoot.attrsQuery, `${TRENDYOL_RAW_CATEGORY_ATTR}~${encodeTrendyolCategoryParam(slug)}`].filter(
        Boolean
      ) as string[];
      return `${baseHref}?attrs=${encodeURIComponent(tokens.join(","))}`;
    }
    return `${baseHref}?${categoryParam}=${slug}${extraQuery}`;
  }

  function openPanel() {
    setOpen(true);
    if (!activeRootId) setActiveRootId(categories[0].id);
  }

  return (
    <div
      className="relative"
      onMouseEnter={openPanel}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={openPanel}
        className="flex items-center gap-2 px-3 py-2.5 font-bold hover:text-[var(--color-wine)] transition-colors"
      >
        <span className="text-base leading-none">☰</span>
        دسته‌بندی‌ها
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 bg-white border cut-line rounded-lg shadow-lg flex w-[min(90vw,780px)] max-h-[70vh] overflow-hidden">
          {/* ریل چپ -- همه‌ی دسته‌بندی‌های ریشه */}
          <ul className="w-52 shrink-0 border-l cut-line bg-white overflow-y-auto py-2">
            {(showAllRoots ? categories : categories.slice(0, MAX_ROOT_ITEMS_VISIBLE)).map((root) => {
              const guessed = categoryIcon(root.name);
              const hasCustomIcon = !!root.icon;
              const isImagePath = hasCustomIcon && (root.icon!.startsWith("/") || root.icon!.startsWith("http"));
              const icon = hasCustomIcon ? root.icon! : guessed.icon;
              const color = guessed.color;
              return (
                <li key={root.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveRootId(root.id)}
                    className={`w-full text-right px-3 py-2.5 text-sm flex items-center justify-between gap-2 ${
                      activeRoot.id === root.id
                        ? "bg-[var(--color-wine)]/10 text-[var(--color-wine)] font-bold"
                        : "hover:bg-[var(--color-linen-dim)]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isImagePath ? (
                        <span className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 bg-white">
                          <Image src={icon} alt="" fill className="object-cover" unoptimized />
                        </span>
                      ) : (
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {icon}
                        </span>
                      )}
                      {root.name}
                    </span>
                    {root.children.length > 0 && <span className="text-[10px]">‹</span>}
                  </button>
                </li>
              );
            })}
            {!showAllRoots && categories.length > MAX_ROOT_ITEMS_VISIBLE && (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAllRoots(true)}
                  className="w-full text-right px-3 py-2.5 text-xs font-medium text-[var(--color-wine)] underline underline-offset-2"
                >
                  نمایش بیشتر ⌄
                </button>
              </li>
            )}
          </ul>

          {/* پنل چندستونه -- زیرمجموعه‌های دسته‌ی فعال */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeRoot.children.length === 0 ? (
              <Link
                href={hrefFor(activeRoot.slug)}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-[var(--color-wine)] hover:underline"
              >
                مشاهده‌ی همه‌ی محصولات {activeRoot.name} ←
              </Link>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {activeRoot.children.map((child) => {
                  const shown = child.children.slice(0, MAX_ITEMS_PER_COLUMN);
                  const hasMore = child.children.length > MAX_ITEMS_PER_COLUMN;
                  return (
                    <div key={child.id}>
                      <Link
                        href={hrefFor(child.slug)}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-1 font-bold text-sm mb-2 text-[var(--color-wine)] hover:underline"
                      >
                        {child.name}
                        {child.children.length > 0 && <span className="text-xs">‹</span>}
                      </Link>
                      <ul className="space-y-1.5">
                        {shown.map((grandchild) => (
                          <li key={grandchild.id}>
                            <Link
                              href={hrefFor(grandchild.slug)}
                              onClick={() => setOpen(false)}
                              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-wine)]"
                            >
                              {grandchild.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {hasMore && (
                        <Link
                          href={hrefFor(child.slug)}
                          onClick={() => setOpen(false)}
                          className="inline-block mt-1.5 text-xs font-medium text-[var(--color-wine)] underline underline-offset-2"
                        >
                          بیشتر ببین ⌄
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useTransition } from "react";
import type { CategoryNode } from "@/lib/categories";
import { CurrencyInput } from "@/components/CurrencyInput";

const SORT_OPTIONS = [
  { value: "recommended", label: "پیشنهادی" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
  { value: "discount", label: "بیشترین تخفیف" },
  { value: "newest", label: "جدیدترین" },
  { value: "popular", label: "پرفروش‌ترین" },
  { value: "most_viewed", label: "پربازدیدترین" },
  { value: "favorited", label: "محبوب‌ترین" },
  { value: "most_reviewed", label: "پربازدیدترین نظرات" },
];

// بازه‌های پیشنهادی قیمت -- مثل فیلتر «Fiyat» ترندیول: چند بازه‌ی آماده که کل محدوده رو پوشش می‌دن
function buildPriceBuckets(min: number, max: number, count = 6) {
  const range = Math.max(max - min, 1);
  const step = range / count;
  const points = Array.from({ length: count + 1 }, (_, i) => Math.round(min + step * i));
  return Array.from({ length: count }, (_, i) => ({
    min: points[i],
    max: i === count - 1 ? max : points[i + 1],
  }));
}

// بخش جمع‌شونده با فلش -- دقیقاً مثل هر بخش فیلتر توی سایدبار ترندیول (Kategori ⌃، Marka ⌃، ...)
export function FilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b cut-line pb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between font-bold mb-2 text-right"
      >
        {title}
        <span className={`text-xs text-[var(--color-muted)] transition-transform ${open ? "" : "-rotate-90"}`}>
          ⌃
        </span>
      </button>
      {open && children}
    </div>
  );
}

// چک‌باکس سفارشی -- مربعی و پررنگ، شبیه استایل ترندیول به‌جای چک‌باکس پیش‌فرض مرورگر
export function FilterCheckbox({
  checked,
  onChange,
  label,
  bold = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer py-0.5">
      <span className="relative w-[18px] h-[18px] shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer absolute inset-0 opacity-0 cursor-pointer"
        />
        <span className="block w-full h-full rounded-[4px] border-2 border-[var(--color-line)] peer-checked:bg-[var(--color-wine)] peer-checked:border-[var(--color-wine)] transition-colors" />
        <svg
          viewBox="0 0 20 20"
          className="absolute inset-0 m-auto w-3 h-3 fill-white opacity-0 peer-checked:opacity-100 pointer-events-none"
        >
          <path d="M8 13.4 4.6 10l-1.4 1.4L8 16.2 16.8 7.4 15.4 6z" />
        </svg>
      </span>
      <span className={bold ? "font-bold" : ""}>{label}</span>
    </label>
  );
}

// کلید روشن/خاموش -- برای فیلترهای بولی مثل «ارسال فوری» و «فقط حراج فلش»، دقیقاً استایل ترندیول
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1.5 gap-3">
      <span>{label}</span>
      <span className="relative inline-block w-10 h-[22px] shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer absolute inset-0 opacity-0 cursor-pointer"
        />
        <span className="block w-full h-full rounded-full bg-[var(--color-line)] peer-checked:bg-[var(--color-wine)] transition-colors" />
        <span className="absolute top-[3px] right-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:-translate-x-[18px]" />
      </span>
    </label>
  );
}

// یه گره دسته‌بندی + بچه‌هاش (تورفته) -- انتخاب یه گره والد توی سرور خودکار
// به همه‌ی فرزندانش هم گسترش پیدا می‌کنه (نیازی به منطق خاص اینجا نیست)
function CategoryTreeItem({
  node,
  depth,
  selected,
  onToggle,
  forceExpand = false,
}: {
  node: CategoryNode;
  depth: number;
  selected: string[];
  onToggle: (slug: string) => void;
  forceExpand?: boolean;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded || forceExpand;

  return (
    <li>
      <div className="flex items-center gap-1.5" style={{ paddingRight: `${depth * 14}px` }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[var(--color-muted)] w-4 shrink-0"
            aria-label={isExpanded ? "بستن" : "باز کردن"}
          >
            {isExpanded ? "▾" : "◂"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <FilterCheckbox
          checked={selected.includes(node.slug)}
          onChange={() => onToggle(node.slug)}
          label={node.name}
          bold={depth === 0}
        />
      </div>
      {hasChildren && isExpanded && (
        <ul className="space-y-0.5 mt-1">
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onToggle={onToggle}
              forceExpand={forceExpand}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// جستجو توی درخت دسته‌بندی -- گره‌ای نگه داشته می‌شه اگه خودش مچ باشه (با همه‌ی
// زیرشاخه‌های اصلیش) یا یکی از فرزندانش (حتی غیرمستقیم) مچ باشه
function filterCategoryTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  function filterNode(node: CategoryNode): CategoryNode | null {
    const selfMatch = node.name.toLowerCase().includes(q);
    if (selfMatch) return node;
    const filteredChildren = node.children
      .map(filterNode)
      .filter((n): n is CategoryNode => n !== null);
    if (filteredChildren.length === 0) return null;
    return { ...node, children: filteredChildren };
  }

  return nodes.map(filterNode).filter((n): n is CategoryNode => n !== null);
}

export function ProductFilters({
  categories,
  brands,
  priceBounds,
  availableFacets = {},
}: {
  categories: CategoryNode[];
  brands: string[];
  priceBounds: { min: number; max: number };
  availableFacets?: Record<string, string[]>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedCategories = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
  const selectedBrands = searchParams.get("brands")?.split(",").filter(Boolean) ?? [];
  const selectedAttrs = searchParams.get("attrs")?.split(",").filter(Boolean) ?? [];
  const sort = searchParams.get("sort") ?? "recommended";
  const minRating = Number(searchParams.get("minRating")) || 0;
  const fastShipping = searchParams.get("fastShipping") === "true";
  const flashSaleOnly = searchParams.get("flashSaleOnly") === "true";

  const [brandQuery, setBrandQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [attrQueries, setAttrQueries] = useState<Record<string, string>>({});

  const [minPrice, setMinPrice] = useState(
    Number(searchParams.get("minPrice")) || priceBounds.min
  );
  const [maxPrice, setMaxPrice] = useState(
    Number(searchParams.get("maxPrice")) || priceBounds.max
  );

  // اگر URL از بیرون تغییر کرد (مثلا دکمه بازگشت مرورگر) state اسلایدر رو هم‌سو کن
  useEffect(() => {
    setMinPrice(Number(searchParams.get("minPrice")) || priceBounds.min);
    setMaxPrice(Number(searchParams.get("maxPrice")) || priceBounds.max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      // replace (نه push) که تاریخچه‌ی مرورگر با هر تیک زدن پر نشه، و scroll:false
      // که با هر تغییر فیلتر صفحه نپره بالا -- چک‌باکس با خود تغییر searchParams
      // فوری آپدیت می‌شه، startTransition فقط رندر پس‌زمینه‌ی نتایج رو نرم می‌کنه
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  function toggleInList(key: "categories" | "brands" | "attrs", value: string) {
    const current =
      key === "categories"
        ? selectedCategories
        : key === "brands"
        ? selectedBrands
        : selectedAttrs;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateParams({ [key]: next.join(",") || null });
  }

  function commitPriceRange() {
    updateParams({
      minPrice: minPrice > priceBounds.min ? String(minPrice) : null,
      maxPrice: maxPrice < priceBounds.max ? String(maxPrice) : null,
    });
  }

  // برندهای تیک‌خورده میان بالای لیست تا کاربر بدون اسکرول ببینه تا الان چی
  // انتخاب کرده -- sort جاوااسکریپت پایداره، پس ترتیب بقیه‌ی برندها به‌هم نمی‌خوره
  const filteredBrands = brands
    .filter((b) => b.toLowerCase().includes(brandQuery.trim().toLowerCase()))
    .sort((a, b) => Number(selectedBrands.includes(b)) - Number(selectedBrands.includes(a)));
  const filteredCategories = filterCategoryTree(categories, categoryQuery);

  return (
    <aside
      className={`space-y-4 text-sm transition-opacity md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto pl-1 pb-4 ${
        isPending ? "opacity-60" : "opacity-100"
      }`}
    >
      {/* مرتب‌سازی */}
      <FilterSection title="مرتب‌سازی">
        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value === "recommended" ? null : e.target.value })}
          className="w-full border cut-line rounded-lg px-3 py-2 bg-white"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FilterSection>

      {/* تحویل و پیشنهادهای ویژه -- تاگل‌های واقعی و کاربردی (نه نمایشی) */}
      <FilterSection title="پیشنهادهای ویژه">
        <ToggleSwitch
          checked={fastShipping}
          onChange={() => updateParams({ fastShipping: fastShipping ? null : "true" })}
          label="🚚 فقط ارسال فوری"
        />
        <ToggleSwitch
          checked={flashSaleOnly}
          onChange={() => updateParams({ flashSaleOnly: flashSaleOnly ? null : "true" })}
          label="⚡ فقط حراج فلش"
        />
      </FilterSection>

      {/* قیمت */}
      <FilterSection title="قیمت">
        <div className="flex items-center gap-2 mb-3">
          <CurrencyInput
            placeholder="حداقل"
            value={String(minPrice)}
            onChange={(v) => setMinPrice(v ? Number(v) : priceBounds.min)}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white text-sm"
          />
          <span className="text-[var(--color-muted)]">−</span>
          <CurrencyInput
            placeholder="حداکثر"
            value={String(maxPrice)}
            onChange={(v) => setMaxPrice(v ? Number(v) : priceBounds.max)}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white text-sm"
          />
          <button
            type="button"
            onClick={commitPriceRange}
            aria-label="اعمال محدوده قیمت"
            className="shrink-0 w-9 h-9 rounded-lg bg-[var(--color-wine)] text-white flex items-center justify-center"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-white">
              <path d="M13.6 12.2a6 6 0 1 0-1.4 1.4l3.5 3.5 1.4-1.4-3.5-3.5ZM8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
            </svg>
          </button>
        </div>

        <ul className="space-y-0.5">
          {(() => {
            const currentMin = Number(searchParams.get("minPrice")) || priceBounds.min;
            const currentMax = Number(searchParams.get("maxPrice")) || priceBounds.max;
            return buildPriceBuckets(priceBounds.min, priceBounds.max).map((bucket, i) => {
              const isSelected = currentMin === bucket.min && currentMax === bucket.max;
              return (
                <li key={i}>
                  <label className="flex items-center gap-2.5 cursor-pointer py-0.5">
                    <span className="relative w-[18px] h-[18px] shrink-0">
                      <input
                        type="radio"
                        name="priceBucket"
                        checked={isSelected}
                        onChange={() => {
                          setMinPrice(bucket.min);
                          setMaxPrice(bucket.max);
                          updateParams({
                            minPrice: bucket.min > priceBounds.min ? String(bucket.min) : null,
                            maxPrice: bucket.max < priceBounds.max ? String(bucket.max) : null,
                          });
                        }}
                        className="peer absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <span className="block w-full h-full rounded-full border-2 border-[var(--color-line)] peer-checked:border-[var(--color-wine)] transition-colors" />
                      <span className="absolute inset-[4px] rounded-full bg-[var(--color-wine)] scale-0 peer-checked:scale-100 transition-transform" />
                    </span>
                    <span>
                      {bucket.min.toLocaleString("fa-IR")} - {bucket.max.toLocaleString("fa-IR")} تومان
                    </span>
                  </label>
                </li>
              );
            });
          })()}
        </ul>
      </FilterSection>

      {/* دسته‌بندی - درختی، چندانتخابی (انتخاب یه والد همه‌ی زیرمجموعه‌هاشو هم فیلتر می‌کنه) */}
      <FilterSection title="دسته‌بندی">
        <input
          type="text"
          value={categoryQuery}
          onChange={(e) => setCategoryQuery(e.target.value)}
          placeholder="دسته مورد نظر را جستجو کنید"
          className="w-full border cut-line rounded-lg px-3 py-1.5 mb-2 bg-white text-xs"
        />
        <ul className="space-y-0.5 max-h-64 overflow-y-auto">
          {filteredCategories.length === 0 ? (
            <li className="text-xs text-[var(--color-muted)] py-1">دسته‌ای پیدا نشد.</li>
          ) : (
            filteredCategories.map((root) => (
              <CategoryTreeItem
                key={root.id}
                node={root}
                depth={0}
                selected={selectedCategories}
                onToggle={(slug) => toggleInList("categories", slug)}
                forceExpand={categoryQuery.trim().length > 0}
              />
            ))
          )}
        </ul>
      </FilterSection>

      {/* منبع دیگه اینجا فیلتر نمی‌شه -- مزون همیشه توی /products هست، و هر
          فروشگاه دیگه (ترندیول، ترندیول‌میلا، ...) صفحه‌ی مخصوص خودش رو داره
          (/marketplaces/[slug]) با فیلترهای متناسب با همون سایت */}

      {/* برند - چندانتخابی، با جستجوی داخلی (مثل «Marka Ara» ترندیول) */}
      {brands.length > 0 && (
        <FilterSection title="برند">
          <input
            type="text"
            value={brandQuery}
            onChange={(e) => setBrandQuery(e.target.value)}
            placeholder="برند مورد نظر را جستجو کنید"
            className="w-full border cut-line rounded-lg px-3 py-1.5 mb-2 bg-white text-xs"
          />
          <ul className="space-y-0.5 max-h-48 overflow-y-auto">
            {filteredBrands.length === 0 ? (
              <li className="text-xs text-[var(--color-muted)] py-1">برندی پیدا نشد.</li>
            ) : (
              filteredBrands.map((b) => (
                <li key={b}>
                  <FilterCheckbox
                    checked={selectedBrands.includes(b)}
                    onChange={() => toggleInList("brands", b)}
                    label={b}
                  />
                </li>
              ))
            )}
          </ul>
        </FilterSection>
      )}

      {/* ویژگی‌ها - چندانتخابی و عمومی (جنسیت، رنگ، ...) -- مستقل از دسته‌بندی */}
      {Object.entries(availableFacets).map(([attrName, values]) => {
        const query = attrQueries[attrName] ?? "";
        // مقادیر تیک‌خورده میان بالای لیست تا کاربر بدون اسکرول ببینه تا الان
        // چی انتخاب کرده
        const filteredValues = values
          .filter((v) => v.toLowerCase().includes(query.trim().toLowerCase()))
          .sort((a, b) => {
            const aSelected = selectedAttrs.includes(`${attrName}~${a}`);
            const bSelected = selectedAttrs.includes(`${attrName}~${b}`);
            return Number(bSelected) - Number(aSelected);
          });
        return (
          <FilterSection key={attrName} title={attrName}>
            <input
              type="text"
              value={query}
              onChange={(e) => setAttrQueries((prev) => ({ ...prev, [attrName]: e.target.value }))}
              placeholder={`جستجوی ${attrName}`}
              className="w-full border cut-line rounded-lg px-3 py-1.5 mb-2 bg-white text-xs"
            />
            <ul className="space-y-0.5 max-h-48 overflow-y-auto">
              {filteredValues.length === 0 ? (
                <li className="text-xs text-[var(--color-muted)] py-1">موردی پیدا نشد.</li>
              ) : (
                filteredValues.map((value) => {
                  const token = `${attrName}~${value}`;
                  return (
                    <li key={token}>
                      <FilterCheckbox
                        checked={selectedAttrs.includes(token)}
                        onChange={() => toggleInList("attrs", token)}
                        label={value}
                      />
                    </li>
                  );
                })
              )}
            </ul>
          </FilterSection>
        );
      })}

      {/* حداقل امتیاز */}
      <FilterSection title="حداقل امتیاز">
        <ul className="space-y-0.5">
          {[4, 3, 2].map((r) => (
            <li key={r}>
              <label className="flex items-center gap-2.5 cursor-pointer py-0.5">
                <span className="relative w-[18px] h-[18px] shrink-0">
                  <input
                    type="radio"
                    name="minRating"
                    checked={minRating === r}
                    onChange={() => updateParams({ minRating: String(r) })}
                    className="peer absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <span className="block w-full h-full rounded-full border-2 border-[var(--color-line)] peer-checked:border-[var(--color-wine)] transition-colors" />
                  <span className="absolute inset-[4px] rounded-full bg-[var(--color-wine)] scale-0 peer-checked:scale-100 transition-transform" />
                </span>
                <span className="text-[var(--color-ochre)]">{"★".repeat(r)}</span>
                <span className="text-[var(--color-muted)]">و بالاتر</span>
              </label>
            </li>
          ))}
          <li>
            <label className="flex items-center gap-2.5 cursor-pointer py-0.5">
              <span className="relative w-[18px] h-[18px] shrink-0">
                <input
                  type="radio"
                  name="minRating"
                  checked={minRating === 0}
                  onChange={() => updateParams({ minRating: null })}
                  className="peer absolute inset-0 opacity-0 cursor-pointer"
                />
                <span className="block w-full h-full rounded-full border-2 border-[var(--color-line)] peer-checked:border-[var(--color-wine)] transition-colors" />
                <span className="absolute inset-[4px] rounded-full bg-[var(--color-wine)] scale-0 peer-checked:scale-100 transition-transform" />
              </span>
              همه
            </label>
          </li>
        </ul>
      </FilterSection>

      {(selectedCategories.length > 0 ||
        selectedBrands.length > 0 ||
        selectedAttrs.length > 0 ||
        minRating > 0 ||
        fastShipping ||
        flashSaleOnly ||
        minPrice > priceBounds.min ||
        maxPrice < priceBounds.max) && (
        <button
          onClick={() => router.push(pathname)}
          className="text-xs text-[var(--color-muted)] underline"
        >
          پاک کردن همه فیلترها
        </button>
      )}
    </aside>
  );
}

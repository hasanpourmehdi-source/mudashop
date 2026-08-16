"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flattenCategoryTree, categoryPath, TreeCategory } from "@/lib/categoryTree";

type Option = { id: string; label: string };

export function CategoryCombobox<T extends TreeCategory>({
  categories,
  value,
  onChange,
  placeholder = "انتخاب دسته‌بندی...",
  rootLabel,
  excludeIds = [],
  invalid = false,
}: {
  categories: T[];
  value: string; // categoryId انتخاب‌شده، یا "" برای هیچ‌کدام/ریشه
  onChange: (id: string) => void;
  placeholder?: string;
  rootLabel?: string; // اگه پر باشه، یه گزینه "بدون والد" با این متن نشون داده می‌شه
  excludeIds?: string[]; // شناسه‌هایی که نباید قابل انتخاب باشن (مثلا خود آیتم یا فرزندانش)
  invalid?: boolean; // برای نشون دادن حالت خطا (کادر قرمز) وقتی این فیلد اجباریه و خالی مونده
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(""); // چیزی که فعلاً تایپ شده (فقط وقتی باز/در حال تایپه معتبره)
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const visible = useMemo(
    () => categories.filter((c) => !excludeIds.includes(c.id)),
    [categories, excludeIds]
  );
  const treeOrder = useMemo(() => flattenCategoryTree(visible), [visible]);

  const selectedLabel = value ? categoryPath(categories, value) : rootLabel ?? "";

  const filtered = query.trim()
    ? treeOrder.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : treeOrder;

  // لیست یکپارچه گزینه‌ها (شامل "بدون والد" اگه لازم باشه) که کیبورد روش حرکت می‌کنه
  const options: Option[] = useMemo(() => {
    const list: Option[] = [];
    if (rootLabel && !query) list.push({ id: "", label: rootLabel });
    for (const c of filtered) {
      list.push({ id: c.id, label: query ? categoryPath(categories, c.id) : c.name });
    }
    return list;
  }, [filtered, rootLabel, query, categories]);

  // با تغییر عبارت جستجو یا باز شدن، اولین گزینه (یا تنها نتیجه) هایلایت پیش‌فرض می‌شه
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  useEffect(() => {
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectOption(option: Option) {
    onChange(option.id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function handleFocus() {
    setOpen(true);
    // با فوکوس، خالی می‌کنیم تا کاربر بلافاصله بتونه تایپ کنه و سرچ کنه
    // (به‌جای اینکه مجبور باشه اول متن قبلی رو پاک کنه)
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = options[highlightedIndex];
      if (chosen) selectOption(chosen);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={open ? query : selectedLabel}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={selectedLabel ? undefined : placeholder}
        className={`w-full border cut-line rounded-lg px-3 py-2 bg-white text-sm text-right ${
          invalid ? "!border-red-600" : ""
        }`}
      />

      {open && (
        <div className="absolute top-full mt-1 w-full bg-white border cut-line rounded-lg shadow-lg z-40 max-h-72 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-3 text-sm text-[var(--color-muted)]">چیزی پیدا نشد.</p>
          ) : (
            options.map((opt, index) => {
              const cat = query
                ? filtered.find((c) => c.id === opt.id)
                : treeOrder.find((c) => c.id === opt.id);
              const isRoot = rootLabel && !query && index === 0;
              return (
                <button
                  key={opt.id || "__root__"}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{ paddingInlineStart: query || isRoot ? 12 : 12 + (cat?.depth ?? 0) * 18 }}
                  className={`w-full text-right px-3 py-2 text-sm flex items-center gap-1.5 ${
                    index === highlightedIndex ? "bg-[var(--color-linen-dim)]" : ""
                  } ${value === opt.id ? "text-[var(--color-wine)] font-medium" : ""}`}
                >
                  {!query && !isRoot && (cat?.depth ?? 0) > 0 && (
                    <span className="text-[var(--color-muted)]">└─</span>
                  )}
                  <span>{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

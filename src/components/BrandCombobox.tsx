"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Brand = { id: string; name: string };

export function BrandCombobox({
  brands,
  value,
  onChange,
  onBrandCreated,
  placeholder = "انتخاب برند...",
  rootLabel = "بدون برند",
}: {
  brands: Brand[];
  value: string; // brandId انتخاب‌شده، یا "" برای بدون برند
  onChange: (id: string) => void;
  onBrandCreated?: (brand: Brand) => void; // وقتی برند جدید همین‌جا ساخته می‌شه
  placeholder?: string;
  rootLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = value ? brands.find((b) => b.id === value)?.name ?? "" : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  const exactMatch = brands.some((b) => b.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = query.trim().length > 0 && !exactMatch;

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

  function selectBrand(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) return;
      onBrandCreated?.(data);
      selectBrand(data.id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={open ? query : selectedLabel}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        placeholder={selectedLabel ? undefined : placeholder}
        className="w-full border cut-line rounded-lg px-3 py-2 bg-white text-sm text-right"
      />

      {open && (
        <div className="absolute top-full mt-1 w-full bg-white border cut-line rounded-lg shadow-lg z-40 max-h-72 overflow-y-auto">
          {rootLabel && !query && (
            <button
              type="button"
              onClick={() => selectBrand("")}
              className={`w-full text-right px-3 py-2 text-sm ${
                value === "" ? "text-[var(--color-wine)] font-medium" : ""
              }`}
            >
              {rootLabel}
            </button>
          )}
          {filtered.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => selectBrand(b.id)}
              className={`w-full text-right px-3 py-2 text-sm ${
                value === b.id ? "text-[var(--color-wine)] font-medium" : ""
              }`}
            >
              {b.name}
            </button>
          ))}
          {filtered.length === 0 && !canCreate && (
            <p className="px-3 py-3 text-sm text-[var(--color-muted)]">چیزی پیدا نشد.</p>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="w-full text-right px-3 py-2 text-sm text-[var(--color-wine)] border-t cut-line disabled:opacity-50"
            >
              {creating ? "در حال ساخت..." : `+ افزودن برند جدید: «${query.trim()}»`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

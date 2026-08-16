"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

type Suggestion = {
  id: string;
  title: string;
  image: string;
  price: number;
  href: string;
};

export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // اگه کاربر الان توی صفحه‌ی یه مارکت‌پلیس خاص (مثلاً ترندیول) هست، جستجو باید
  // فقط همون‌جا و فقط روی همون سایت انجام بشه -- نه توی /products (که مخصوص
  // محصولات مزونه). اگه نه، مثل قبل به /products (سرچ مزون) می‌فرستیم.
  const marketplaceMatch = pathname.match(/^\/marketplaces\/([^/]+)/);
  const marketplaceSlug = marketplaceMatch?.[1] ?? null;

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          setSuggestions(data);
          setOpen(true);
        });
    }, 250); // debounce
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    if (marketplaceSlug) {
      // شروع تازه‌ی جستجو -- عمداً category/attrs/sst قبلی رو نگه نمی‌داریم چون
      // جستجوی متنی جایگزین فیلتر دسته‌بندی می‌شه، نه ترکیب‌شونده باهاش (فعلاً)
      router.push(`/marketplaces/${marketplaceSlug}?q=${encodeURIComponent(query)}`);
    } else {
      router.push(`/products?q=${encodeURIComponent(query)}`);
    }
  }

  return (
    <div ref={boxRef} className="relative flex-1 max-w-2xl hidden md:block">
      <form onSubmit={handleSubmit} className="relative">
        <span className="absolute inset-y-0 right-4 flex items-center text-[var(--color-muted)] pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="جستجوی محصول، دسته‌بندی یا برند..."
          className="w-full border cut-line rounded-full pr-11 pl-4 py-2.5 text-sm bg-[var(--color-linen-dim)] focus:bg-white transition-colors"
        />
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white border cut-line rounded-lg shadow-lg overflow-hidden z-40">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setOpen(false);
                setQuery("");
                router.push(s.href);
              }}
              className="w-full flex items-center gap-3 p-2 hover:bg-[var(--color-linen-dim)] text-right"
            >
              <div className="relative w-10 h-10 shrink-0 bg-[var(--color-linen-dim)] rounded overflow-hidden">
                {s.image && (
                  <Image src={s.image} alt={s.title} fill className="object-cover" unoptimized />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{s.title}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {s.price.toLocaleString("fa-IR")} تومان
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

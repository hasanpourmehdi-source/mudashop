"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

type ProductSuggestion = { id: string; title: string; image: string; price: number; href: string };
type CategorySuggestion = { id: string; title: string; icon: string | null; image: string | null; href: string };
type BrandSuggestion = { id: string; title: string; href: string };
type CampaignSuggestion = { id: string; title: string; image: string; href: string };

type SearchResults = {
  categories: CategorySuggestion[];
  brands: BrandSuggestion[];
  campaigns: CampaignSuggestion[];
  products: ProductSuggestion[];
};

const EMPTY_RESULTS: SearchResults = { categories: [], brands: [], campaigns: [], products: [] };

export function SearchBox({ mobile = false }: { mobile?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // اگه کاربر الان توی صفحه‌ی یه مارکت‌پلیس خاص (مثلاً ترندیول) هست، جستجو باید
  // فقط همون‌جا و فقط روی همون سایت انجام بشه -- نه توی /products (که مخصوص
  // محصولات مزونه). اگه نه، مثل قبل به /products (سرچ مزون) می‌فرستیم.
  const marketplaceMatch = pathname.match(/^\/marketplaces\/([^/]+)/);
  const marketplaceSlug = marketplaceMatch?.[1] ?? null;

  const hasResults =
    results.categories.length > 0 ||
    results.brands.length > 0 ||
    results.campaigns.length > 0 ||
    results.products.length > 0;

  useEffect(() => {
    // /api/search فقط کاتالوگ مزونه -- توی صفحه‌ی یه مارکت‌پلیس (که جست‌وجوش
    // با Enter مستقیم به خودِ سایت اصلی می‌زنه)، نشون‌دادن پیشنهاد از مزون
    // گمراه‌کننده‌ست، پس این‌جا پیشنهاد زنده‌ای نشون نمی‌دیم
    if (marketplaceSlug || query.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data: SearchResults) => {
          setResults(data);
          setOpen(true);
        });
    }, 250); // debounce
    return () => clearTimeout(timeout);
  }, [query, marketplaceSlug]);

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

  function goTo(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div ref={boxRef} className={`relative flex-1 max-w-2xl ${mobile ? "w-full" : "hidden md:block"}`}>
      <form onSubmit={handleSubmit} noValidate className="relative">
        <span className="absolute inset-y-0 right-4 flex items-center text-[var(--color-muted)] pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hasResults && setOpen(true)}
          placeholder="جستجوی محصول، دسته‌بندی یا برند..."
          aria-label="جستجوی محصول، دسته‌بندی یا برند"
          className={`w-full border cut-line rounded-full pr-11 pl-4 text-sm bg-[var(--color-linen-dim)] focus:bg-white transition-colors ${
            mobile ? "py-2" : "py-2.5"
          }`}
        />
      </form>

      {open && hasResults && (
        <div className="absolute top-full mt-2 w-full bg-white border cut-line rounded-lg shadow-lg overflow-hidden z-40 max-h-[70vh] overflow-y-auto">
          {results.categories.map((c) => (
            <SuggestionRow key={`cat-${c.id}`} onClick={() => goTo(c.href)} badge="دسته‌بندی">
              <RowIcon icon={c.icon} image={c.image} fallback="📁" />
              <p className="text-sm truncate min-w-0 flex-1">{c.title}</p>
            </SuggestionRow>
          ))}

          {results.brands.map((b) => (
            <SuggestionRow key={`brand-${b.id}`} onClick={() => goTo(b.href)} badge="برند">
              <RowIcon icon="🏷️" image={null} fallback="🏷️" />
              <p className="text-sm truncate min-w-0 flex-1">{b.title}</p>
            </SuggestionRow>
          ))}

          {results.campaigns.map((c) => (
            <SuggestionRow key={`camp-${c.id}`} onClick={() => goTo(c.href)} badge="کمپین">
              <RowIcon icon={null} image={c.image} fallback="🎯" />
              <p className="text-sm truncate min-w-0 flex-1">{c.title}</p>
            </SuggestionRow>
          ))}

          {results.products.map((p) => (
            <SuggestionRow key={`prod-${p.id}`} onClick={() => goTo(p.href)}>
              <RowIcon icon={null} image={p.image} fallback="🛍️" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{p.title}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {p.price.toLocaleString("fa-IR")} تومان
                </p>
              </div>
            </SuggestionRow>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({
  children,
  onClick,
  badge,
}: {
  children: React.ReactNode;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 hover:bg-[var(--color-linen-dim)] text-right border-b cut-line last:border-b-0"
    >
      {children}
      {badge && (
        <span className="shrink-0 text-[10px] font-bold text-[var(--color-muted)] bg-[var(--color-linen-dim)] px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

function RowIcon({
  icon,
  image,
  fallback,
}: {
  icon?: string | null;
  image: string | null;
  fallback: string;
}) {
  return (
    <div className="relative w-10 h-10 shrink-0 bg-[var(--color-linen-dim)] rounded overflow-hidden flex items-center justify-center text-lg">
      {image ? (
        <Image src={image} alt="" fill className="object-cover" unoptimized />
      ) : (
        <span>{icon || fallback}</span>
      )}
    </div>
  );
}

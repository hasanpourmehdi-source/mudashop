"use client";

import { useRouter } from "next/navigation";

export function ActiveFilterChipsBar({
  chips,
  attrsParam,
  categoryParam,
  sstParam,
  slug,
  basePath,
}: {
  chips: { token: string; label: string }[];
  attrsParam?: string;
  categoryParam?: string;
  sstParam?: string;
  slug: string;
  // پیش‌فرض صفحه‌ی اصلیِ مارکت‌پلیسه؛ صفحه‌ی «محصولاتِ این کمپین» (که همین
  // کامپوننت رو هم داره) باید موقعِ حذفِ یه چیپ همینجا (روی /campaign/[id])
  // بمونه، نه پرش به صفحه‌ی اصلی -- پس مسیرِ پایه رو صریح می‌ده
  basePath?: string;
}) {
  const router = useRouter();

  if (chips.length === 0) return null;

  function removeChip(token: string) {
    const currentTokens = attrsParam?.split(",").filter(Boolean) ?? [];
    const nextTokens = currentTokens.filter((t) => t !== token);
    const params = new URLSearchParams();
    if (categoryParam) params.set("category", categoryParam);
    if (nextTokens.length > 0) params.set("attrs", nextTokens.join(","));
    if (sstParam) params.set("sst", sstParam);
    router.push(`${basePath ?? `/marketplaces/${slug}`}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 [scrollbar-width:none]">
      {chips.map((chip) => (
        <button
          key={chip.token}
          onClick={() => removeChip(chip.token)}
          className="flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-[#fff1e0] border border-[var(--color-ochre)]/40 text-[var(--color-wine)] rounded-full px-3 py-1 text-xs hover:bg-[var(--color-ochre)]/20 transition-colors"
        >
          {chip.label}
          <span className="text-[var(--color-muted)]">×</span>
        </button>
      ))}
    </div>
  );
}

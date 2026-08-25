"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompare } from "@/hooks/useCompare";

// نوار شناور پایین صفحه (مثل آمازون): وقتی حداقل یک محصول در لیست مقایسه هست،
// تصویر/عنوان انتخاب‌ها + حذف + دکمه‌ی «مقایسه» را نشان می‌دهد.
export function CompareBar() {
  const { items, remove, clear, ids } = useCompare();
  const pathname = usePathname();

  if (ids.length === 0) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-40 px-4">
      <div className="max-w-3xl mx-auto border cut-line rounded-2xl bg-white shadow-lg px-4 py-3 ml-16 sm:ml-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 overflow-x-auto flex-1">
            {items.map((p) => (
              <div key={p.id} className="relative shrink-0 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt={p.title}
                  className="w-12 h-12 rounded-lg object-cover border cut-line"
                />
                <button
                  onClick={() => remove(p.id)}
                  aria-label="حذف از مقایسه"
                  className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-[var(--color-wine)] text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={clear}
            className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-wine)] shrink-0"
          >
            پاک کردن
          </button>

          <Link
            href="/compare"
            className={`shrink-0 bg-[var(--color-wine)] text-white rounded-full px-4 py-2 text-sm font-bold ${
              pathname === "/compare" ? "pointer-events-none opacity-70" : ""
            }`}
          >
            مقایسه ({ids.length.toLocaleString("fa-IR")})
          </Link>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useMobileFilterSheet } from "@/components/MobileFilterSheetContext";

// دکمه‌ی «فیلترها»ی موبایل -- فقط پایین‌تر از md نشون داده می‌شه (توی وب، خودِ
// سایدبار همیشه نمایانه، این دکمه لازم نیست)؛ کنارِ دکمه‌ی مرتب‌سازی، دقیقاً
// مثلِ ردیفِ «Sırala | Filtrele»ی اپِ ترندیول
export function MobileFilterTriggerButton({ activeCount }: { activeCount: number }) {
  const { setOpen } = useMobileFilterSheet();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="md:hidden shrink-0 flex items-center gap-1.5 border cut-line rounded-lg px-3 py-2 bg-white text-sm"
    >
      <span aria-hidden="true">☰</span>
      فیلترها
      {activeCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-wine)] text-white text-[10px] font-bold">
          {activeCount.toLocaleString("fa-IR")}
        </span>
      )}
    </button>
  );
}

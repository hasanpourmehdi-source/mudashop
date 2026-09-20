"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// چیدمانِ فیلترهای مزون (ExternalSiteFilters) توی وب (md به بالا) یه سایدبارِ
// همیشه‌-نمایانه، ولی توی موبایل باید مثلِ اپِ ترندیول (نه خودِ وب) یه شیت/مودالِ
// جداگانه با دکمه‌ی «فیلترها» باز بشه -- طبقِ درخواستِ صریح: «میشه چیدمان صفحه
// توی وب و اپ با هم فرق داشته باشه». دکمه‌ی محرک (کنارِ دکمه‌ی مرتب‌سازی توی
// نوارِ ابزار) و خودِ شیت (داخلِ ExternalSiteFilters) توی دو تا کامپوننتِ جدا
// و غیرِهم‌خانواده‌ان (هر دو زیرِ همون گریدِ صفحه)، پس state بازبودنش رو با یه
// Context مشترک نگه می‌داریم، نه prop drilling
type MobileFilterSheetState = { open: boolean; setOpen: (open: boolean) => void };

const MobileFilterSheetContext = createContext<MobileFilterSheetState | null>(null);

export function MobileFilterSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileFilterSheetContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileFilterSheetContext.Provider>
  );
}

export function useMobileFilterSheet(): MobileFilterSheetState {
  const ctx = useContext(MobileFilterSheetContext);
  if (!ctx) {
    throw new Error("useMobileFilterSheet باید داخل MobileFilterSheetProvider استفاده بشه");
  }
  return ctx;
}

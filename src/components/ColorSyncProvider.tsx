"use client";

import { createContext, useContext, useState } from "react";

type ColorSyncContextType = {
  selectedColor: string | undefined;
  setSelectedColor: (color: string | undefined) => void;
};

// مقدار پیش‌فرض no-op -- اگه یه کامپوننت بدون Provider استفاده بشه (مثلا صفحه محصول ترندیول)
// خطا نمی‌ده، فقط هیچ‌وقت رنگی رو sync نمی‌کنه
const ColorSyncContext = createContext<ColorSyncContextType>({
  selectedColor: undefined,
  setSelectedColor: () => {},
});

export function ColorSyncProvider({ children }: { children: React.ReactNode }) {
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  return (
    <ColorSyncContext.Provider value={{ selectedColor, setSelectedColor }}>
      {children}
    </ColorSyncContext.Provider>
  );
}

export function useColorSync() {
  return useContext(ColorSyncContext);
}

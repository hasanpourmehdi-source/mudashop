"use client";

import { createContext, useContext, type ReactNode } from "react";

// مقدارِ اولیه از سرور (RootLayout) میاد و توی همون رندرِ اول ثابت می‌مونه --
// برای تغییرِ فلگ‌ها ادمین باید صفحه رو رفرش کنه، نیازی به sync زنده نیست
const FeatureFlagsContext = createContext<Record<string, boolean>>({});

export function FeatureFlagsProvider({
  flags,
  children,
}: {
  flags: Record<string, boolean>;
  children: ReactNode;
}) {
  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): Record<string, boolean> {
  return useContext(FeatureFlagsContext);
}

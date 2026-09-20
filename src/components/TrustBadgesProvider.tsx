"use client";

import { createContext, useContext, type ReactNode } from "react";

// عیناً همون الگویِ FeatureFlagsProvider.tsx -- مقدار از سرور (RootLayout، که
// از قبل برایِ فوتر همین رو حساب می‌کرد) میاد، تا کامپوننت‌های کلاینتی
// (مثلِ چک‌اوت) هم بدونِ یه fetch/round-trip جدا بهش دسترسی داشته باشن
const TrustBadgesContext = createContext<{ icon: string; text: string }[]>([]);

export function TrustBadgesProvider({
  trustBadges,
  children,
}: {
  trustBadges: { icon: string; text: string }[];
  children: ReactNode;
}) {
  return <TrustBadgesContext.Provider value={trustBadges}>{children}</TrustBadgesContext.Provider>;
}

export function useTrustBadges(): { icon: string; text: string }[] {
  return useContext(TrustBadgesContext);
}

"use client";

import { createContext, useContext, type ReactNode } from "react";

// عیناً همون الگویِ TrustBadgesProvider/FeatureFlagsProvider -- مقدار از سرور
// (RootLayout) میاد تا کامپوننت‌های کلاینتیِ خرید (AddToCartForm، چک‌اوت) بدونِ
// fetch جدا بدونن فروش موقتاً متوقفه یا نه. توجه: این فقط UI رو مخفی/غیرفعال
// می‌کنه -- سدِ واقعی و غیرقابل‌دورزدن توی خودِ POST /api/orders هست
export type SalesPausedState = { paused: boolean; message: string };

const SalesPausedContext = createContext<SalesPausedState>({ paused: false, message: "" });

export function SalesPausedProvider({
  value,
  children,
}: {
  value: SalesPausedState;
  children: ReactNode;
}) {
  return <SalesPausedContext.Provider value={value}>{children}</SalesPausedContext.Provider>;
}

export function useSalesPaused(): SalesPausedState {
  return useContext(SalesPausedContext);
}

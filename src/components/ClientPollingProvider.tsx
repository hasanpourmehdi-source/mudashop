"use client";

import { createContext, useContext, type ReactNode } from "react";

// بازه‌ی پولینگِ بج‌ها/پیام‌ها/وضعیتِ سفارش -- از تنظیماتِ ادمین
// (CLIENT_POLL_INTERVAL_SECONDS)، همون الگویِ SalesPausedProvider: RootLayout
// مقدار رو از همون یک کوئریِ تنظیمات می‌ده، بدونِ fetch جدا
const ClientPollingContext = createContext<number>(30_000);

export function ClientPollingProvider({ intervalMs, children }: { intervalMs: number; children: ReactNode }) {
  return <ClientPollingContext.Provider value={intervalMs}>{children}</ClientPollingContext.Provider>;
}

export function usePollIntervalMs(): number {
  return useContext(ClientPollingContext);
}

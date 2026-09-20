"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ReactNode } from "react";

// RootLayout از قبل session رو سمتِ سرور با auth() می‌گیره (برای isAdmin و...) --
// پاس‌دادنش اینجا باعث می‌شه SessionProvider همون مقدار رو به‌عنوانِ حالتِ
// اولیه استفاده کنه و مجبور نباشه بلافاصله موقعِ mount یه GET /api/auth/session
// جدا بزنه (که قبلاً روی *هر* بازدید، حتی مهمانِ لاگین‌نکرده، اتفاق می‌افتاد)
export function Providers({ children, session }: { children: ReactNode; session: Session | null }) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

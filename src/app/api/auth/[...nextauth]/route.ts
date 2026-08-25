import { handlers } from "@/lib/auth";
import { registerDeviceAfterAuth } from "@/lib/security";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const res = await handlers.GET(req);
  // برای ورود گوگل هم (callback که GET است) دستگاه را ثبت می‌کنیم
  await registerDeviceAfterAuth(req, res);
  return res;
}

export async function POST(req: NextRequest) {
  const res = await handlers.POST(req);
  // بعد از ورود موفق با ایمیل/رمز، دستگاه را ثبت می‌کنیم
  await registerDeviceAfterAuth(req, res);
  return res;
}
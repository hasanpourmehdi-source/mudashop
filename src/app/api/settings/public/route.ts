import { NextResponse } from "next/server";
import { getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";

// تنظیمات سراسری که کامپوننت‌های کلاینتی (مثل صفحه‌ی چک‌اوت) لازم دارن ولی
// خودشون سرور-ساید نیستن که مستقیم getSiteSetting صدا بزنن -- بدون احراز
// هویت، چون فقط پرچم‌های نمایشی‌ان (نه داده‌ی حساس)
export async function GET() {
  const cashOnDeliveryEnabled = await getSiteSettingBool(SITE_SETTING_KEYS.CASH_ON_DELIVERY_ENABLED);
  return NextResponse.json({ cashOnDeliveryEnabled });
}

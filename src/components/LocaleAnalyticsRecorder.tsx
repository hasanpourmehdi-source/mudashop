"use client";

import { useEffect } from "react";

const STORAGE_KEY = "mudashop_locale_logged_at";
// حداکثر یک‌بار در ماه به‌ازای هر مرورگر ثبت می‌شه -- هم برای اینکه جدول
// VisitorLocale پر از رکوردهای تکراریِ بی‌فایده نشه، هم برای اینکه اگه کاربر
// زبانِ مرورگرش رو عوض کرد، دیر یا زود دوباره نمونه‌گیری بشه
const RELOG_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

// کاملاً بی‌صدا و بدون UI -- فقط یه‌بار در هر بار mount (که با ناوبری بین
// صفحات دوباره اجرا نمی‌شه چون توی layout ریشه‌ست) زبانِ مرورگر رو با
// /api/analytics/locale ثبت می‌کند تا بعداً بشه فهمید واقعاً چقدر بازدیدکننده‌ی
// غیرفارسی‌زبان داریم -- قبل از سرمایه‌گذاری روی ترجمه‌ی واقعیِ محتوا
export function LocaleAnalyticsRecorder() {
  useEffect(() => {
    try {
      const lastLogged = Number(localStorage.getItem(STORAGE_KEY) ?? "0");
      if (Date.now() - lastLogged < RELOG_INTERVAL_MS) return;

      fetch("/api/analytics/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: navigator.language }),
      })
        .then(() => localStorage.setItem(STORAGE_KEY, String(Date.now())))
        .catch(() => {});
    } catch {
      // localStorage ممکنه در حالت خصوصی/غیرفعال باشه -- نادیده می‌گیریم
    }
  }, []);

  return null;
}

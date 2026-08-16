"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // فقط توی production ثبت می‌شه. توی next dev، Turbopack چانک‌های
    // جاوااسکریپت رو با آدرس ثابت هر بار محتوای جدید سرو می‌کنه (HMR)، ولی
    // استراتژی کش این service worker برای فایل‌های استاتیک «اول کش»ه --
    // یعنی همون اولین نسخه‌ی هر چانک برای همیشه کش می‌مونه و هیچ تغییر کدی
    // (حتی بعد از رفرش) به دست مرورگر نمی‌رسه، مگر با پاک‌کردن دستی کش/
    // service worker. این دقیقاً باعث hydration mismatch بین HTML تازه‌ی
    // سرور و باندل کلاینتِ کهنه می‌شه.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("خطا در ثبت service worker:", err);
      });
    }
  }, []);

  return null;
}

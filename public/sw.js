const CACHE_NAME = "mudashop-v2"; // نسخه بالا رفت تا کش‌های قدیمی (شامل RSC های اشتباهاً کش‌شده) پاک بشن
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // درخواست‌های غیر-GET (POST/PATCH/DELETE)، همه مسیرهای API، و درخواست‌های RSC prefetch نکست‌جی‌اس
  // (که با ?_rsc= مشخص می‌شن) همیشه مستقیم به شبکه می‌رن -- این‌ها داده‌ی پویای هر صفحه‌ن،
  // نباید مثل فایل استاتیک کش بشن وگرنه بعد از هر تغییر (محصول جدید، ویرایش و ...) همون نسخه‌ی
  // قدیمی/۴۰۴ برای همیشه برمی‌گرده
  if (
    request.method !== "GET" ||
    request.url.includes("/api/") ||
    request.url.includes("_rsc=") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch")
  ) {
    return;
  }

  // ناوبری بین صفحات: اول شبکه، اگه آفلاین بود از کش یا صفحه آفلاین
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
      )
    );
    return;
  }

  // فایل‌های استاتیک (تصاویر، فونت، JS/CSS بیلد شده): اول کش، بعد شبکه
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});

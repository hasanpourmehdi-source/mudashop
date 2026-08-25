const CACHE_NAME = "mudashop-v3"; // نسخه بالا رفت تا کش‌های قدیمی (شامل RSC های اشتباهاً کش‌شده) پاک بشن
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
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

  // ناوبری بین صفحات: اول شبکه (و کش کردن صفحه‌ی بازدیدشده برای آفلاین)،
  // اگه آفلاین بود از کش یا صفحه آفلاین
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
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

// اعلانِ پوش از سرور (notifyCustomerOutbound -> web-push) رسیده -- بدنه‌ش
// JSON با {title, body, url} است (همون چیزی که deliverPush می‌فرسته)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "مُداشاپ", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "مُداشاپ";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    dir: "rtl",
    lang: "fa",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// کلیک روی اعلان -- اگه تبی با همون آدرس باز بود فوکوسش می‌کنیم، وگرنه تب
// جدید باز می‌شه
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === url && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

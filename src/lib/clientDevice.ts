// کوکی ثابت مرورگر برای تشخیص «دستگاه» هنگام ورود. فقط سمت کلاینت استفاده می‌شود.

export function ensureDeviceCookie(): string {
  const name = "device_id";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (match && match[1]) return match[1];

  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  document.cookie = `${name}=${id}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
  return id;
}
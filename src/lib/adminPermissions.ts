// حیطه‌های دسترسیِ قابل‌تخصیص به یک حساب STAFF -- ADMIN همیشه به همه‌چی دسترسی
// کامل دارد (این لیست فقط برای STAFF معنا دارد). چون این‌ها با AdminScope
// (پریزما) هم‌نام‌اند، اگه یه کلید جدید اضافه شد باید هر دو جا هم‌زمان به‌روز شن.
export const ADMIN_SCOPES = ["SUPPORT", "PURCHASING", "PAYMENTS", "PRODUCTS", "ORDERS", "SETTINGS"] as const;
export type AdminScope = (typeof ADMIN_SCOPES)[number];

export const ADMIN_SCOPE_LABELS: Record<AdminScope, string> = {
  SUPPORT: "پشتیبانی (پیام‌های مشتری)",
  PURCHASING: "پیگیریِ خریدِ کالای خارجی",
  PAYMENTS: "تأیید پرداخت + برداشت کیف‌پول",
  PRODUCTS: "محصولات/دسته‌بندی/برند",
  ORDERS: "مدیریت عمومیِ سفارش‌ها",
  SETTINGS: "تنظیمات سایت",
};

export function isAdminScope(value: string): value is AdminScope {
  return (ADMIN_SCOPES as readonly string[]).includes(value);
}

// رشته‌ی JSON ذخیره‌شده‌ی User.adminScopes رو به آرایه‌ی معتبر تبدیل می‌کنه --
// هر مقدارِ ناشناخته/خراب رو بی‌صدا حذف می‌کنه (خالص و قابل‌تست)
export function parseAdminScopes(raw: string): AdminScope[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is AdminScope => typeof v === "string" && isAdminScope(v)) : [];
  } catch {
    return [];
  }
}

// آیا این کاربر (بر اساس role + رشته‌ی خام scopes) به یک حیطه‌ی خاص دسترسی دارد؟
// ADMIN همیشه true؛ STAFF فقط اگه اون scope رو صریحاً داشته باشد؛ CUSTOMER هیچ‌وقت.
export function hasAdminScope(
  role: string | undefined | null,
  rawScopes: string | undefined | null,
  scope: AdminScope
): boolean {
  if (role === "ADMIN") return true;
  if (role !== "STAFF") return false;
  return parseAdminScopes(rawScopes ?? "[]").includes(scope);
}

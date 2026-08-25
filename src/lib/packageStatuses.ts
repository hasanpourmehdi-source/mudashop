// وضعیت تحویلِ تک‌تک بسته‌های یه سفارش. چون سفارش ممکنه توی چند بسته ارسال
// بشه و جزئی تحویل داده بشه، به‌جای اینکه فقط کل سفارش DELIVERED بشه، هر بسته
// می‌تونه جداگانه «تحویل داده شده» ثبت بشه -- مشتری می‌بینه کدوم رسیده و
// کدوم هنوز در راهه. همون الگوی trackingCode: یه رشته‌ی JSON توی Order.
export type PackageArrivalStatus = "IN_TRANSIT" | "ARRIVED";

export type PackageStatus = {
  code: string;
  status: PackageArrivalStatus;
  arrivedAt: string | null; // ISO
};

export function parsePackageStatuses(raw: string | null | undefined): PackageStatus[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PackageStatus =>
        typeof p?.code === "string" &&
        p.code.trim().length > 0 &&
        (p.status === "IN_TRANSIT" || p.status === "ARRIVED")
    );
  } catch {
    return [];
  }
}

export function serializePackageStatuses(statuses: PackageStatus[]): string {
  return JSON.stringify(statuses.map((s) => ({ code: s.code, status: s.status, arrivedAt: s.arrivedAt })));
}

// وقتی ادمین کدهای رهگیری رو ثبت/ویرایش می‌کنه، وضعیت‌های از قبل ثبت‌شده (مثل
// «تحویل داده شده») برای اون کد حفظ می‌شن و کدهای جدید IN_TRANSIT اضافه می‌شن --
// تا ویرایش کدها/افزودن بسته‌ی جدید باعث ناپدیدشدنِ تاریخچه‌ی رسیدن نشه
export function mergePackageStatuses(existingRaw: string | null | undefined, codes: string[]): PackageStatus[] {
  const existing = parsePackageStatuses(existingRaw);
  const byCode = new Map(existing.map((s) => [s.code, s]));

  const result: PackageStatus[] = [];
  for (const code of codes) {
    const prev = byCode.get(code);
    if (prev) {
      result.push(prev);
    } else {
      result.push({ code, status: "IN_TRANSIT", arrivedAt: null });
    }
  }
  return result;
}

export function markPackageArrived(
  existingRaw: string | null | undefined,
  code: string,
  now: Date = new Date()
): { statuses: PackageStatus[]; found: boolean; allArrived: boolean } {
  const statuses = parsePackageStatuses(existingRaw);
  let found = false;
  let allArrived = true;

  for (const s of statuses) {
    if (s.code === code) {
      found = true;
      if (s.status !== "ARRIVED") {
        s.status = "ARRIVED";
        s.arrivedAt = now.toISOString();
      }
    }
    if (s.status !== "ARRIVED") allArrived = false;
  }

  return { statuses, found, allArrived };
}
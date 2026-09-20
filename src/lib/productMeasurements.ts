// اندازه‌ی واقعیِ فیزیکیِ یه ترکیب (سایز) از محصول -- ProductVariant.measurements
// به‌صورت JSON استرینگ ذخیره می‌شه؛ این تابع خواندنش رو یک‌جا و امن می‌کند
// (ورودی‌های خراب/ناقص رو به‌جای کرش، فقط نادیده می‌گیره)

export type VariantMeasurement = { label: string; cm: number };

export function parseVariantMeasurements(raw: string | null | undefined): VariantMeasurement[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is VariantMeasurement =>
        m &&
        typeof m === "object" &&
        typeof m.label === "string" &&
        m.label.trim().length > 0 &&
        typeof m.cm === "number" &&
        Number.isFinite(m.cm) &&
        m.cm > 0
    );
  } catch {
    return [];
  }
}

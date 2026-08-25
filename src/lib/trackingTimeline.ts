import { parsePackageStatuses } from "@/lib/packageStatuses";

// تایملاین رهگیری مرحله‌به‌مرحله (مثل آمازون) -- از تاریخچه‌ی وضعیت سفارش +
// تحویلِ تکی بسته‌ها ساخته می‌شه (ETA در هدرِ OrderTracking نمایش داده
// می‌شه و این‌جا تکرار نمی‌شه). خالص و بدون DB -- برای تست.
export type TimelineState = "done" | "active" | "pending";

export type TimelineEntry = {
  id: string;
  title: string;
  detail?: string;
  at: string; // ISO
  state: TimelineState;
  kind: "event" | "package";
};

export type TrackingTimelineInput = {
  status: string;
  statusHistory: { id: string; status: string; note: string | null; createdAt: string }[];
  packageStatuses?: string | null;
};

export function buildTrackingTimeline(input: TrackingTimelineInput): TimelineEntry[] {
  const inProgress = !["CANCELLED", "DELIVERED", "RETURNED"].includes(input.status);

  // رویدادهای تاریخچه‌ی وضعیت (مرتب‌شده‌ی صعودی)
  const historyEntries = input.statusHistory
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((h) => ({
      id: `h-${h.id}`,
      title: h.note || h.status,
      at: h.createdAt,
      kind: "event" as const,
    }));

  // تحویلِ تک‌تک بسته‌ها -- به‌همراه تاریخچه در یک ردیف زمانی واحد
  const packageEvents = parsePackageStatuses(input.packageStatuses)
    .filter((p) => p.status === "ARRIVED" && p.arrivedAt)
    .map((p) => ({
      id: `pkg-${p.code}`,
      title: `بسته ${p.code} تحویل داده شد`,
      at: p.arrivedAt as string,
      kind: "package" as const,
    }));

  const merged = [...historyEntries, ...packageEvents].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  // سفارش در جریان است → آخرین اتفاق «الان» است؛ بقیه گذشته. سفارش بسته
  // (تحویل/لغو/مرجوع) → همه‌چیز انجام‌شده و گره‌ی «در جریان» نداریم
  return merged.map((e, i) => ({
    id: e.id,
    title: e.title,
    at: e.at,
    state: inProgress && i === merged.length - 1 ? "active" : "done",
    kind: e.kind,
  }));
}
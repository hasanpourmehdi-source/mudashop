"use client";

import type { TimelineEntry } from "@/lib/trackingTimeline";

// تایملاین عمودی مرحله‌به‌مرحله (مثل آمازون) -- ریل در سمت راست (چون RTL).
// گره‌های انجام‌شده تیک می‌خورند و مرحله‌ی فعلی (آخرین رویداد سفارشِ در جریان)
// پالس می‌زند و برچسب «در جریان» می‌گیرد.
export function TrackingTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="border cut-line rounded-xl bg-white p-4">
      <h2 className="font-bold text-sm mb-4">پیگیری سفارش</h2>
      <ol>
        {entries.map((entry, i) => {
          const isLast = i === entries.length - 1;
          const icon = entry.state === "done" ? "✓" : "●";

          return (
            <li key={entry.id} className="flex gap-3">
              {/* ستون گره + خط اتصال */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    entry.state === "done"
                      ? "bg-[var(--color-wine)] text-white"
                      : entry.state === "active"
                        ? "bg-[var(--color-wine)] text-white ring-4 ring-[var(--color-wine)]/25 animate-pulse"
                        : "bg-white border-2 border-dashed border-[var(--color-line)] text-[var(--color-muted)]"
                  }`}
                >
                  {entry.kind === "package" && entry.state === "done" ? "📦" : icon}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 my-0.5 ${
                      entry.state === "done" ? "bg-[var(--color-wine)]" : "bg-[var(--color-line)]"
                    }`}
                  />
                )}
              </div>

              {/* محتوا */}
              <div className={`pb-5 min-h-[2.5rem] ${isLast ? "pb-0" : ""}`}>
                <p
                  className={`text-sm ${
                    entry.state === "active"
                      ? "text-[var(--color-wine)] font-bold"
                      : entry.state === "pending"
                        ? "text-[var(--color-muted)]"
                        : "font-medium"
                  }`}
                >
                  {entry.title}
                </p>
                {entry.state === "active" && (
                  <p className="text-[10px] text-[var(--color-wine)] font-medium mt-0.5">در جریان</p>
                )}
                {entry.at && (
                  <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                    {new Date(entry.at).toLocaleString("fa-IR")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
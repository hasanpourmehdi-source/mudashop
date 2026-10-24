"use client";

import Link from "next/link";
import { useState } from "react";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { usePollIntervalMs } from "@/components/ClientPollingProvider";

// لینک «پیام‌ها» با بجِ نخوانده -- فقط برای مشتری (ادمین از پنل خودش پاسخ می‌دهد)
export function MessageLink({ admin = false }: { admin?: boolean }) {
  const [unread, setUnread] = useState(0);
  const intervalMs = usePollIntervalMs();

  // ادمین اصلاً این لینک رو نمی‌بینه، پس پولینگ هم نمی‌خواد
  useVisiblePolling(
    () => {
      fetch("/api/support/unread")
        .then((res) => (res.ok ? res.json() : { unread: 0 }))
        .then((data) => setUnread(data.unread ?? 0))
        .catch(() => {});
    },
    intervalMs,
    { enabled: !admin },
  );

  if (admin) return null;

  return (
    <Link
      href="/messages"
      className="relative transition-colors hover:text-[var(--color-ochre)]"
      title="پیام‌ها و پشتیبانی"
    >
      پیام‌ها
      {unread > 0 && (
        <span className="absolute -top-1.5 -left-2 min-w-4 h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
          {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
        </span>
      )}
    </Link>
  );
}
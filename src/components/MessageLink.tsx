"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// لینک «پیام‌ها» با بجِ نخوانده -- فقط برای مشتری (ادمین از پنل خودش پاسخ می‌دهد)
export function MessageLink({ admin = false }: { admin?: boolean }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/support/unread")
        .then((res) => (res.ok ? res.json() : { unread: 0 }))
        .then((data) => {
          if (alive) setUnread(data.unread ?? 0);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

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
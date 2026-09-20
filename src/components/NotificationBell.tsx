"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type Notification = {
  id: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  function load() {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : { notifications: [], unreadCount: 0 }))
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      });
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    load();
    // هر ۶۰ ثانیه یه چک تازه -- چون سرویس push نداریم، ساده‌ترین راه polling کمه.
    // فقط وقتی تبِ مرورگر واقعاً بازه/دیده می‌شه -- تبِ پس‌زمینه/مخفی هیچ
    // درخواستی نمی‌فرسته، و همون لحظه‌ای که کاربر برگرده به تب یه‌بار تازه می‌شه
    let interval: ReturnType<typeof setInterval> | null = null;
    function startPolling() {
      if (interval) return;
      interval = setInterval(load, 60000);
    }
    function stopPolling() {
      if (interval) clearInterval(interval);
      interval = null;
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        load();
        startPolling();
      } else {
        stopPolling();
      }
    }
    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [status]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      await fetch("/api/notifications", { method: "POST" });
    }
  }

  if (status !== "authenticated") return null;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="اعلان‌ها"
        className="relative p-1.5 hover:text-[var(--color-wine)] transition-colors"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-wine)] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "۹+" : unreadCount.toLocaleString("fa-IR")}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] bg-white border cut-line rounded-lg shadow-lg max-h-80 overflow-y-auto overflow-x-hidden">
          {notifications.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] p-4 text-center">اعلانی نداری.</p>
          ) : (
            notifications.map((n) => {
              const content = (
                <div
                  className={`px-3 py-2.5 text-sm border-b cut-line last:border-0 ${
                    !n.isRead ? "bg-[var(--color-linen-dim)]" : ""
                  }`}
                >
                  <p className="break-words">{n.message}</p>
                  <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
                    {new Date(n.createdAt).toLocaleDateString("fa-IR")}
                  </p>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

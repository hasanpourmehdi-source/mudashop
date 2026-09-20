"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type NotificationRow = { id: string; message: string; link: string | null; isRead: boolean };

// اعلانِ ارتقاءِ سطحِ باشگاه (که بک‌اند موقعِ تحویلِ سفارش می‌سازه) قبلاً فقط
// یه ردیفِ ساکت توی زنگوله بود؛ اینجا همون اعلانِ خونده‌نشده رو یه‌بار موقعِ
// بازکردنِ سایت به‌صورتِ یه مودالِ جشن‌گونه نشون می‌دیم -- بستنش (مثلِ بازکردنِ
// زنگوله) همه‌ی اعلان‌ها رو خونده‌شده علامت می‌زنه، پس دوباره تکرار نمی‌شه
export function LoyaltyLevelUpToast() {
  const { status } = useSession();
  const [notice, setNotice] = useState<NotificationRow | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : { notifications: [] }))
      .then((data) => {
        const levelUp = (data.notifications ?? []).find(
          (n: NotificationRow) => !n.isRead && n.link === "/loyalty" && n.message.startsWith("🎉")
        );
        if (levelUp) setNotice(levelUp);
      })
      .catch(() => {});
  }, [status]);

  function dismiss() {
    setNotice(null);
    fetch("/api/notifications", { method: "POST" }).catch(() => {});
  }

  if (!notice) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
      onClick={dismiss}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-4xl">🎉</p>
        <p className="font-bold text-lg">{notice.message}</p>
        <div className="flex gap-2 justify-center pt-2">
          <Link
            href="/loyalty"
            onClick={dismiss}
            className="bg-[var(--color-wine)] text-white rounded-full px-5 py-2 text-sm font-medium"
          >
            مشاهده‌ی سطح
          </Link>
          <button
            onClick={dismiss}
            className="border cut-line rounded-full px-5 py-2 text-sm font-medium"
          >
            باشه
          </button>
        </div>
      </div>
    </div>
  );
}

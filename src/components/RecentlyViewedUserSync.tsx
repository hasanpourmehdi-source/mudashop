"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getRecentlyViewedStore } from "@/store/recentlyViewed";
import type { RecentlyViewedProduct } from "@/lib/recentlyViewed";

// عیناً همون الگویِ CartUserSync.tsx -- «اخیراً دیده‌اید» تا الان فقط
// localStorageِ همون مرورگر بود؛ این کامپوننت با لاگین، لیستِ مهمانِ همین
// مرورگر رو با لیستِ کاربر ادغام می‌کنه، بعد لیستِ ذخیره‌شده روی سرور (از
// دستگاه‌های دیگه) رو هم merge می‌کنه، و از اون به بعد با هر تغییر (debounce
// شده) دوباره با سرور sync می‌کنه -- تا این لیست بینِ دستگاه‌ها هم قابل‌دیدن باشه
export function RecentlyViewedUserSync() {
  const { data: session, status } = useSession();
  const mergedFor = useRef<string | null>(null);
  // تا وقتی merge اولیه از سرور تموم نشده، هیچ POST ای نباید بره -- وگرنه
  // دستگاهِ جدید با استورِ خالیِ محلی، لیستِ خالی می‌فرسته و سرور لیستِ واقعیِ
  // دستگاهِ قبلی رو پاک می‌کنه
  const mergeCompleted = useRef(false);
  const lastPostedPayload = useRef<string | null>(null);
  const scheduleSyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (mergedFor.current === session.user.id) return;
    mergedFor.current = session.user.id;

    const guestStore = getRecentlyViewedStore("guest");
    const userStore = getRecentlyViewedStore(session.user.id);

    const { items: guestItems } = guestStore.getState();
    if (guestItems.length > 0) {
      userStore.getState().mergeItems(guestItems);
      guestStore.getState().clear();
    }

    fetch("/api/recently-viewed/sync")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: RecentlyViewedProduct[] } | null) => {
        if (data?.items?.length) userStore.getState().mergeItems(data.items);
      })
      .catch(() => {
        // اتصال بی‌اهمیته -- اگه نشه سرور رو خوند، همون لیستِ محلی کار می‌کنه
      })
      .finally(() => {
        mergeCompleted.current = true;
        scheduleSyncRef.current?.();
      });
  }, [status, session?.user?.id]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const userId = session.user.id;
    const store = getRecentlyViewedStore(userId);

    lastPostedPayload.current = null;
    mergeCompleted.current = false;

    const sync = () => {
      if (!mergeCompleted.current) return;
      const { items } = store.getState();
      const body = JSON.stringify({ items });
      if (body === lastPostedPayload.current) return;
      lastPostedPayload.current = body;
      fetch("/api/recently-viewed/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {
        // اتصال بی‌اهمیته -- این فقط یه فیچرِ کمکیه
      });
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSync = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sync, 2000);
    };

    const unsubscribe = store.subscribe(debouncedSync);
    scheduleSyncRef.current = debouncedSync;

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      if (scheduleSyncRef.current === debouncedSync) scheduleSyncRef.current = null;
    };
  }, [status, session?.user?.id]);

  return null;
}

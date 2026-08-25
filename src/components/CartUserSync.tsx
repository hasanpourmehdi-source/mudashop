"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getCartStore } from "@/store/cart";

export function CartUserSync() {
  const { data: session, status } = useSession();
  const mergedFor = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (mergedFor.current === session.user.id) return;

    const guestStore = getCartStore("guest");
    const userStore = getCartStore(session.user.id);

    const guestItems = guestStore.getState().items;
    if (guestItems.length > 0) {
      guestItems.forEach((item) => userStore.getState().addItem(item));
      guestStore.getState().clear();
    }

    mergedFor.current = session.user.id;
  }, [status, session?.user?.id]);

  // یادآوریِ سبدِ رهاشده: با هر تغییرِ سبد (debounce شده)، عکسِ لحظه‌ای‌ش رو
  // با سرور sync می‌کنیم تا runAbandonedCartReminders بدونه چیزی توی سبده و
  // کِی آخرین‌بار تغییر کرده (localStorage از سمتِ سرور دیده نمی‌شه)
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const userId = session.user.id;
    const store = getCartStore(userId);

    const sync = () => {
      const items = store.getState().items.map((i) => ({ title: i.title, quantity: i.quantity }));
      fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      }).catch(() => {
        // اتصال بی‌اهمیته -- یادآوری فقط یه فیچرِ کمکیه، نباید تجربه‌ی خرید رو خراب کند
      });
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSync = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sync, 2000);
    };

    const unsubscribe = store.subscribe(debouncedSync);
    // اولین رندر هم یه‌بار sync بشه (مثلاً بعد از merge شدن سبدِ مهمان)
    debouncedSync();

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [status, session?.user?.id]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getCartStore, type CartItem } from "@/store/cart";

export function CartUserSync() {
  const { data: session, status } = useSession();
  const mergedFor = useRef<string | null>(null);
  // تا وقتی merge اولیه از سرور تموم نشده، هیچ POST ای نباید بره -- وگرنه
  // دستگاهِ جدید با استورِ خالیِ محلی، عکسِ خالی می‌فرسته و سرور سبدِ واقعیِ
  // دستگاه قبلی رو deleteMany می‌کنه (به‌خصوص روی شبکه‌ی کند که GET دیر
  // جواب می‌ده و debounce‌ی ۲ ثانیه‌ای زودتر می‌ترکه)
  const mergeCompleted = useRef(false);
  const lastPostedPayload = useRef<string | null>(null);
  const scheduleSyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (mergedFor.current === session.user.id) return;
    mergedFor.current = session.user.id;

    const guestStore = getCartStore("guest");
    const userStore = getCartStore(session.user.id);

    // قبلاً فقط items مهمان ادغام می‌شد و savedForLaterِ مهمان نه ادغام می‌شد
    // نه پاک -- برای همیشه توی سطلِ "guest" (مشترکِ بینِ همه‌ی مهمان‌های همون
    // مرورگر/دستگاه) باقی می‌موند: هم دیده نمی‌شد (گم‌شده برای همون کاربر)، هم
    // نشتِ حریمِ خصوصی بود (مهمانِ بعدیِ همون دستگاه می‌تونست ببینتش)
    const { items: guestItems, savedForLater: guestSaved } = guestStore.getState();
    guestItems.forEach((item) => userStore.getState().addItem(item));
    if (guestSaved.length > 0) userStore.getState().mergeSavedForLater(guestSaved);
    if (guestItems.length > 0 || guestSaved.length > 0) guestStore.getState().clearAll();

    // همگام‌سازیِ بین‌دستگاهی: هرچی از یه دستگاه دیگه روی سرور ذخیره شده رو
    // با سبد/خریدِ‌بعدیِ همین دستگاه ادغام کن. فقط اقلامی که این‌جا نیستن
    // اضافه می‌شن (mergeItems/mergeSavedForLater) تا با هر رفرشِ صفحه تعداد
    // تصاعدی زیاد نشه
    fetch("/api/cart/sync")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: CartItem[]; savedForLater?: CartItem[] } | null) => {
        if (!data) return;
        if (data.items?.length) userStore.getState().mergeItems(data.items);
        if (data.savedForLater?.length) userStore.getState().mergeSavedForLater(data.savedForLater);
      })
      .catch(() => {
        // اتصال بی‌اهمیته -- اگه نشه سرور رو خوند، همون سبدِ محلی کار می‌کنه
      })
      .finally(() => {
        // حالا که وضعیتِ محلی با سرور آشتی گرفت، اجازه‌ی POST بده و یه
        // sync پایه بزن (چه تغییری کرده باشه چه نه)
        mergeCompleted.current = true;
        scheduleSyncRef.current?.();
      });
  }, [status, session?.user?.id]);

  // یادآوریِ سبدِ رهاشده: با هر تغییرِ سبد (debounce شده)، عکسِ لحظه‌ای‌ش رو
  // با سرور sync می‌کنیم تا runAbandonedCartReminders بدونه چیزی توی سبده و
  // کِی آخرین‌بار تغییر کرده (localStorage از سمتِ سرور دیده نمی‌شه)
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const userId = session.user.id;
    const store = getCartStore(userId);

    // حسابِ عوض شده => تاریخچه‌ی payload قبلی بی‌معنیه
    lastPostedPayload.current = null;
    mergeCompleted.current = false;

    const sync = () => {
      if (!mergeCompleted.current) return;
      const { items, savedForLater } = store.getState();
      const body = JSON.stringify({ items, savedForLater });
      // payload دقیقاً مثل بار قبل => هیچ چیز عوض نشده؛ ارسال نکن. هر POSTِ
      // بی‌دلیل روی سرور reminderStage رو صفر می‌کرد و زنجیره‌ی یادآوریِ
      // ۳ مرحله‌ای برای کاربرِ فعالِ روزانه هیچ‌وقت به مرحله‌ی بعد نمی‌رسید
      if (body === lastPostedPayload.current) return;
      lastPostedPayload.current = body;
      fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
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
    scheduleSyncRef.current = debouncedSync;

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      if (scheduleSyncRef.current === debouncedSync) scheduleSyncRef.current = null;
    };
  }, [status, session?.user?.id]);

  return null;
}

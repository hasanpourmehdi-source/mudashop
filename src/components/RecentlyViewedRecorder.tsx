"use client";

import { useEffect, useRef } from "react";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import type { RecentlyViewedProduct } from "@/lib/recentlyViewed";
import { trackViewItem } from "@/lib/analytics";

// در صفحه‌ی محصول قرار می‌گیره و فقط یک‌بار (بعد از mount در مرورگر) محصول
// رو به «اخیراً دیدهاید» اضافه می‌کنه، و رویداد view_item/ViewContent رو هم
// برای پیکسل تبلیغاتی (برای ریتارگتینگ) می‌فرسته. هیچ چیزی رندر نمی‌کنه.
export function RecentlyViewedRecorder({ product }: { product: RecentlyViewedProduct }) {
  const add = useRecentlyViewed().add;
  const addedRef = useRef(false);

  useEffect(() => {
    if (addedRef.current) return;
    addedRef.current = true;
    add(product);
    trackViewItem({ id: product.id, title: product.title, price: product.price });
  }, [add, product]);

  return null;
}
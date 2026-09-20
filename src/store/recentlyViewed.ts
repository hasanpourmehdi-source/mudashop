import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  addRecentlyViewed,
  removeRecentlyViewed,
  MAX_RECENTLY_VIEWED,
  type RecentlyViewedProduct,
} from "@/lib/recentlyViewed";

type RecentlyViewedState = {
  items: RecentlyViewedProduct[];
  add: (product: RecentlyViewedProduct) => void;
  remove: (id: string) => void;
  clear: () => void;
  mergeItems: (items: RecentlyViewedProduct[]) => void;
};

// می‌سازه یه store جدید و مجزا برای هر کلید (userId یا "guest") -- همون الگوی سبد
function buildRecentlyViewedStore(storageKey: string) {
  return create<RecentlyViewedState>()(
    persist(
      (set) => ({
        items: [],
        add: (product) => set((s) => ({ items: addRecentlyViewed(s.items, product) })),
        remove: (id) => set((s) => ({ items: removeRecentlyViewed(s.items, id) })),
        clear: () => set({ items: [] }),
        // فقط آیتم‌هایی که این‌جا نیستن اضافه می‌شن (مثلِ mergeItems سبد) --
        // وگرنه با هر رفرش/sync، همون آیتم‌های تکراری دوباره بالای لیست می‌رفتن.
        // بعد از ادغام، دوباره بر اساسِ تازه‌ترین viewedAt مرتب و به سقف می‌رسه
        mergeItems: (incoming) =>
          set((s) => {
            const existingIds = new Set(s.items.map((i) => i.id));
            const toAdd = incoming.filter((i) => !existingIds.has(i.id));
            if (toAdd.length === 0) return s;
            const merged = [...s.items, ...toAdd]
              .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
              .slice(0, MAX_RECENTLY_VIEWED);
            return { items: merged };
          }),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => localStorage),
      }
    )
  );
}

// کش استورها بر اساس کلید تا هر بار hook جدید نسازیم
const storeCache = new Map<string, ReturnType<typeof buildRecentlyViewedStore>>();

export function getRecentlyViewedStore(userKey: string) {
  const key = `mudashop-recently-${userKey}`;
  if (!storeCache.has(key)) {
    storeCache.set(key, buildRecentlyViewedStore(key));
  }
  return storeCache.get(key)!;
}
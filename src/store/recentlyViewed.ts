import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  addRecentlyViewed,
  removeRecentlyViewed,
  type RecentlyViewedProduct,
} from "@/lib/recentlyViewed";

type RecentlyViewedState = {
  items: RecentlyViewedProduct[];
  add: (product: RecentlyViewedProduct) => void;
  remove: (id: string) => void;
  clear: () => void;
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
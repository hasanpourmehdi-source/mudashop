import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  addToCompare,
  removeFromCompare,
  MAX_COMPARE_COUNT,
  type CompareProduct,
} from "@/lib/compare";

type CompareState = {
  ids: string[];
  // snapshot نمایشی برای نوار پایین مقایسه (عنوان/عکس/قیمت) -- بدون نیاز به fetch
  items: CompareProduct[];
  toggle: (product: CompareProduct) => void;
  remove: (id: string) => void;
  clear: () => void;
  isInCompare: (id: string) => boolean;
};

function buildCompareStore(storageKey: string) {
  return create<CompareState>()(
    persist(
      (set, get) => ({
        ids: [],
        items: [],
        toggle: (product) =>
          set((s) => {
            const inList = s.ids.includes(product.id);
            const ids = inList
              ? removeFromCompare(s.ids, product.id)
              : addToCompare(s.ids, product.id);
            const items = inList
              ? s.items.filter((p) => p.id !== product.id)
              : [{ ...product }, ...s.items].slice(0, MAX_COMPARE_COUNT);
            return { ids, items };
          }),
        remove: (id) =>
          set((s) => ({
            ids: removeFromCompare(s.ids, id),
            items: s.items.filter((p) => p.id !== id),
          })),
        clear: () => set({ ids: [], items: [] }),
        isInCompare: (id) => get().ids.includes(id),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => localStorage),
      }
    )
  );
}

const storeCache = new Map<string, ReturnType<typeof buildCompareStore>>();

export function getCompareStore(userKey: string) {
  const key = `mudashop-compare-${userKey}`;
  if (!storeCache.has(key)) {
    storeCache.set(key, buildCompareStore(key));
  }
  return storeCache.get(key)!;
}
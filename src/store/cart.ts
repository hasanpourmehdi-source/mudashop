import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  id: string; // ترکیب productId + variantId برای یکتا بودن
  source: "MAZON" | "TRENDYOL";
  productId: string; // slug (مزون) یا external id (ترندیول)
  variantId?: string;
  flashSaleId?: string;
  title: string;
  image: string;
  price: number;
  originalPrice?: number; // قیمت قبل از تخفیف -- فقط وقتی واقعاً تخفیف داره ست می‌شه (برای نمایش خط‌خورده و «سود شما»)
  quantity: number;
  variantLabel?: string; // مثلا "سایز: L / رنگ: قرمز"
  maxStock?: number; // موجودی واقعی در لحظه افزودن -- محصولات ترندیول این رو ندارن (نامحدود)
  fastShipping?: boolean; // فقط محصولات مزون این رو دارن
};

type CartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  total: () => number;
};

// می‌سازه یه store جدید و مجزا برای هر کلید (userId یا "guest")
function buildCartStore(storageKey: string) {
  return create<CartState>()(
    persist(
      (set, get) => ({
        items: [],
        addItem: (item) =>
          set((state) => {
            const existing = state.items.find((i) => i.id === item.id);
            if (existing) {
              const maxStock = existing.maxStock ?? item.maxStock;
              const nextQuantity = existing.quantity + item.quantity;
              return {
                items: state.items.map((i) =>
                  i.id === item.id
                    ? {
                        ...i,
                        maxStock,
                        quantity: maxStock ? Math.min(nextQuantity, maxStock) : nextQuantity,
                      }
                    : i
                ),
              };
            }
            const clampedQuantity = item.maxStock
              ? Math.min(item.quantity, item.maxStock)
              : item.quantity;
            return { items: [...state.items, { ...item, quantity: clampedQuantity }] };
          }),
        removeItem: (id) =>
          set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
        updateQuantity: (id, quantity) =>
          set((state) => ({
            items: state.items.map((i) => {
              if (i.id !== id) return i;
              const clamped = i.maxStock ? Math.min(quantity, i.maxStock) : quantity;
              return { ...i, quantity: Math.max(1, clamped) };
            }),
          })),
        clear: () => set({ items: [] }),
        total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => localStorage),
      }
    )
  );
}

// کش استورها بر اساس کلید تا هر بار hook جدید نسازیم
const storeCache = new Map<string, ReturnType<typeof buildCartStore>>();

export function getCartStore(userKey: string) {
  const key = `mudashop-cart-${userKey}`;
  if (!storeCache.has(key)) {
    storeCache.set(key, buildCartStore(key));
  }
  return storeCache.get(key)!;
}

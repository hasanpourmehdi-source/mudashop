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
  // فقط ترندیول -- اسم دقیقِ همون سایتِ خارجی (مثلاً «ترندیول» یا «میلا») که
  // این قلم ازش اومده. چون هردو source="TRENDYOL" دارن، بدون این فیلد نمی‌شه
  // توی سبدی که همزمان از هر دو سایت قلم داره، فرقشون رو تشخیص داد
  siteLabel?: string;
};

type CartState = {
  items: CartItem[];
  // اقلامی که مشتری از سبدِ فعلی برداشته ولی نخواسته کامل حذفشون کنه -- برای
  // بعد نگه داشته می‌شن (سایز/رنگ/تعداد دست‌نخورده)، جدا از سبدِ فعلی و جدا
  // از علاقه‌مندی‌ها (که صرفاً نشونه‌ی «دوست دارم»ه، نه یه انتخابِ آماده‌ی خرید)
  savedForLater: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  saveForLater: (id: string) => void;
  moveToCart: (id: string) => void;
  removeSaved: (id: string) => void;
  // ادغامِ اقلامِ رسیده از سرور (سینکِ بین‌دستگاهی) -- فقط اقلامی که این‌جا
  // نیستن اضافه می‌شن، نه جمع‌زدنِ تعداد. اگه جمع می‌زدیم، هر بار رفرشِ صفحه
  // (که این ادغام رو دوباره صدا می‌زنه) تعداد رو تصاعدی زیاد می‌کرد
  mergeItems: (items: CartItem[]) => void;
  mergeSavedForLater: (items: CartItem[]) => void;
  clear: () => void;
  total: () => number;
};

// می‌سازه یه store جدید و مجزا برای هر کلید (userId یا "guest")
function buildCartStore(storageKey: string) {
  return create<CartState>()(
    persist(
      (set, get) => ({
        items: [],
        savedForLater: [],
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
        saveForLater: (id) =>
          set((state) => {
            const item = state.items.find((i) => i.id === id);
            if (!item) return state;
            return {
              items: state.items.filter((i) => i.id !== id),
              savedForLater: [...state.savedForLater.filter((i) => i.id !== id), item],
            };
          }),
        moveToCart: (id) =>
          set((state) => {
            const item = state.savedForLater.find((i) => i.id === id);
            if (!item) return state;
            // اگه دقیقاً همون ترکیب از قبل توی سبد بود، جمع‌شون کن -- نه یه ردیفِ تکراری؛
            // مثل addItem/updateQuantity به سقفِ موجودیِ واقعی clamp بشه، وگرنه
            // «بازگشت به سبد» می‌تونه تعداد رو از موجودی بیشتر کنه
            const existing = state.items.find((i) => i.id === id);
            const maxStock = existing?.maxStock ?? item.maxStock;
            const items = existing
              ? state.items.map((i) =>
                  i.id === id
                    ? { ...i, maxStock, quantity: maxStock ? Math.min(i.quantity + item.quantity, maxStock) : i.quantity + item.quantity }
                    : i
                )
              : [...state.items, { ...item, quantity: item.maxStock ? Math.min(item.quantity, item.maxStock) : item.quantity }];
            return { items, savedForLater: state.savedForLater.filter((i) => i.id !== id) };
          }),
        removeSaved: (id) =>
          set((state) => ({ savedForLater: state.savedForLater.filter((i) => i.id !== id) })),
        mergeItems: (incoming) =>
          set((state) => {
            const existingIds = new Set(state.items.map((i) => i.id));
            const toAdd = incoming.filter((i) => !existingIds.has(i.id));
            // یه id باید فقط توی یکی از دو لیست باشه -- اگه دستگاهِ دیگه همون
            // قلم رو «برای بعد» ذخیره کرده بود و این‌جا فعاله، نسخه‌ی saved
            // حذف می‌شه تا moveToCart بعدی تعداد رو روی هم جمع نکنه
            const addedIds = new Set(toAdd.map((i) => i.id));
            const savedForLater = state.savedForLater.filter((i) => !addedIds.has(i.id));
            if (toAdd.length === 0 && savedForLater.length === state.savedForLater.length) return state;
            return { items: [...state.items, ...toAdd], savedForLater };
          }),
        mergeSavedForLater: (incoming) =>
          set((state) => {
            const existingIds = new Set(state.savedForLater.map((i) => i.id));
            // اگه همین قلم فعلاً توی سبدِ فعاله، نسخه‌ی رسیده برای «خرید بعدی»
            // نادیده گرفته می‌شه -- نسخه‌ی سبدِ فعال برنده‌ست؛ دوبل‌بودنِ یه id
            // در دو لیست یعنی جمع‌شدنِ تصادفیِ تعداد موقع بازگشت به سبد
            const skipIds = new Set([...state.savedForLater.map((i) => i.id), ...state.items.map((i) => i.id)]);
            const toAdd = incoming.filter((i) => !skipIds.has(i.id));
            if (toAdd.length === 0) return state;
            return { savedForLater: [...state.savedForLater, ...toAdd] };
          }),
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

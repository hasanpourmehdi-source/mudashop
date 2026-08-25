// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCartStore, type CartItem } from "@/store/cart";

let keyCounter = 0;

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "p-v",
    source: "MAZON",
    productId: "p",
    title: "تیشرت",
    image: "/img.jpg",
    price: 100,
    quantity: 1,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("cart store", () => {
  it("آیتم جدید به سبد اضافه می‌شود", () => {
    const store = getCartStore(`t${keyCounter++}`);
    store.getState().addItem(makeItem());
    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0]).toMatchObject({ id: "p-v", quantity: 1 });
  });

  it("افزودن دوباره همان آیتم، تعداد را جمع می‌زند", () => {
    const store = getCartStore(`t${keyCounter++}`);
    const { addItem } = store.getState();
    addItem(makeItem({ quantity: 2 }));
    addItem(makeItem({ quantity: 3 }));
    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0].quantity).toBe(5);
  });

  it("افزودن مازاد بر موجودی، به maxStock محدود می‌شود", () => {
    const store = getCartStore(`t${keyCounter++}`);
    store.getState().addItem(makeItem({ quantity: 10, maxStock: 4 }));
    expect(store.getState().items[0].quantity).toBe(4);
  });

  it("جمع تعداد برای محصول بی‌موجودی (ترندیول) محدود نمی‌شود", () => {
    const store = getCartStore(`t${keyCounter++}`);
    store.getState().addItem(makeItem({ source: "TRENDYOL", quantity: 10 }));
    expect(store.getState().items[0].quantity).toBe(10);
  });

  it("افزودن آیتم موجود، maxStock موجود را حفظ می‌کند", () => {
    const store = getCartStore(`t${keyCounter++}`);
    const { addItem } = store.getState();
    addItem(makeItem({ quantity: 3, maxStock: 5 }));
    addItem(makeItem({ quantity: 10, maxStock: 100 }));
    expect(store.getState().items[0].quantity).toBe(5);
  });

  it("updateQuantity تعداد را بین ۱ و maxStock نگه می‌دارد", () => {
    const store = getCartStore(`t${keyCounter++}`);
    store.getState().addItem(makeItem({ quantity: 2, maxStock: 10 }));
    const { updateQuantity } = store.getState();
    updateQuantity("p-v", 99);
    expect(store.getState().items[0].quantity).toBe(10);
    updateQuantity("p-v", 0);
    expect(store.getState().items[0].quantity).toBe(1);
  });

  it("removeItem فقط آیتم هدف را حذف می‌کند", () => {
    const store = getCartStore(`t${keyCounter++}`);
    const { addItem, removeItem } = store.getState();
    addItem(makeItem({ id: "a", title: "الف" }));
    addItem(makeItem({ id: "b", title: "ب" }));
    removeItem("a");
    expect(store.getState().items.map((i) => i.id)).toEqual(["b"]);
  });

  it("clear همه را خالی می‌کند", () => {
    const store = getCartStore(`t${keyCounter++}`);
    store.getState().addItem(makeItem());
    store.getState().clear();
    expect(store.getState().items).toHaveLength(0);
  });

  it("total جمع قیمت‌ها را صحیح محاسبه می‌کند", () => {
    const store = getCartStore(`t${keyCounter++}`);
    const { addItem } = store.getState();
    addItem(makeItem({ id: "a", price: 100, quantity: 2 }));
    addItem(makeItem({ id: "b", price: 50, quantity: 3 }));
    expect(store.getState().total()).toBe(350);
  });

  it("با کلید متفاوت، سبدی مستقل و جدا دارد", () => {
    const storeA = getCartStore(`t${keyCounter++}`);
    const storeB = getCartStore(`t${keyCounter++}`);
    storeA.getState().addItem(makeItem({ id: "a" }));
    expect(storeB.getState().items).toHaveLength(0);
  });
});
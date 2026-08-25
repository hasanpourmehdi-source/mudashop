// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const sessionMock = vi.hoisted(() => ({
  useSession: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ useSession: sessionMock.useSession }));

import { getCartStore, type CartItem } from "@/store/cart";
import { useCart } from "@/hooks/useCart";

const GUEST_KEY = "guest";
const USER_A_KEY = "user-42";
const USER_B_KEY = "user-99";
const trackedUserKeys = [GUEST_KEY, USER_A_KEY, USER_B_KEY];

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

// استورها به‌صورت ماژولی کش می‌شوند؛ برای استقلال تست‌ها state هر کلید را صفر می‌کنیم
function resetCartStores() {
  for (const key of trackedUserKeys) {
    getCartStore(key).setState({ items: [] });
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

beforeEach(() => {
  sessionMock.useSession.mockReset();
  resetCartStores();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionMock.useSession.mockReset();
  resetCartStores();
});

describe("useCart", () => {
  it("بدون لاگین، سبد مهمان (guest) را استفاده می‌کند", async () => {
    sessionMock.useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.items).toEqual([]));
    act(() => {
      result.current.addItem(makeItem({ id: "guest-item" }));
    });
    expect(getCartStore(GUEST_KEY).getState().items.map((i) => i.id)).toEqual(["guest-item"]);
  });

  it("با کاربر لاگین، سبد جداگانه‌ی userId را استفاده می‌کند", async () => {
    sessionMock.useSession.mockReturnValue({
      data: { user: { id: USER_A_KEY } },
      status: "authenticated",
    });
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.items).toEqual([]));
    act(() => {
      result.current.addItem(makeItem({ id: "user-a-item" }));
    });
    expect(getCartStore(USER_A_KEY).getState().items.map((i) => i.id)).toEqual(["user-a-item"]);
    expect(getCartStore(GUEST_KEY).getState().items).toHaveLength(0);
  });

  it("کاربران متفاوت، سبدهای کاملاً مستقل دارند", async () => {
    sessionMock.useSession.mockReturnValue({ data: { user: { id: USER_A_KEY } }, status: "authenticated" });
    const a = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(a.result.current.items).toEqual([]));
    act(() => {
      a.result.current.addItem(makeItem({ id: "from-a" }));
    });

    sessionMock.useSession.mockReturnValue({ data: { user: { id: USER_B_KEY } }, status: "authenticated" });
    const b = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(b.result.current.items).toEqual([]));
    act(() => {
      b.result.current.addItem(makeItem({ id: "from-b" }));
    });

    expect(getCartStore(USER_A_KEY).getState().items.map((i) => i.id)).toEqual(["from-a"]);
    expect(getCartStore(USER_B_KEY).getState().items.map((i) => i.id)).toEqual(["from-b"]);
    expect(getCartStore(GUEST_KEY).getState().items).toHaveLength(0);
  });
});
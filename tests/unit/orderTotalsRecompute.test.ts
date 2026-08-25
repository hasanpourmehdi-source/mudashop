import { describe, expect, it, vi } from "vitest";
import { recomputeOrderTotals } from "@/lib/orderTotals";
import { GIFT_WRAP_COST } from "@/lib/shipping";

type TxMock = {
  order: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    subtotal: 0,
    total: 0,
    discountTotal: 100,
    giftWrap: false,
    items: [
      { price: 1000, quantity: 2, orderId: "order-1" },
      { price: 500, quantity: 1, orderId: "order-1" },
    ],
    ...overrides,
  };
}

function makeTx(order: ReturnType<typeof makeOrder>): TxMock {
  return {
    order: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        ...order,
        ...args.data,
      })),
    },
  };
}

describe("recomputeOrderTotals", () => {
  it("subtotal و total را از اقلام فعلی سفارش محاسبه می‌کند", async () => {
    const tx = makeTx(makeOrder());
    await recomputeOrderTotals(tx as never, "order-1");

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 2500, total: 2400 },
    });
  });

  it("کادوپیچ به total اضافه می‌شود ولی subtotal را دست نمی‌زند", async () => {
    const tx = makeTx(makeOrder({ giftWrap: true }));
    await recomputeOrderTotals(tx as never, "order-1");

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 2500, total: 2500 - 100 + GIFT_WRAP_COST },
    });
  });

  it("discountTotal (کوپن) دست‌نخورده می‌ماند", async () => {
    const tx = makeTx(makeOrder({ discountTotal: 250 }));
    await recomputeOrderTotals(tx as never, "order-1");

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 2500, total: 2250 },
    });
  });

  it("اقلام خالی => subtotal و total صفر", async () => {
    const tx = makeTx(makeOrder({ items: [], total: 999 }));
    await recomputeOrderTotals(tx as never, "order-1");

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 0, total: -100 },
    });
  });

  it("سفارش پیدا نشود، خطا منتشر می‌شود و update صدا زده نمی‌شود", async () => {
    const tx = {
      order: {
        findUniqueOrThrow: vi.fn().mockRejectedValue(new Error("NotFound")),
        update: vi.fn(),
      },
    };
    await expect(recomputeOrderTotals(tx as never, "ghost")).rejects.toThrow("NotFound");
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});
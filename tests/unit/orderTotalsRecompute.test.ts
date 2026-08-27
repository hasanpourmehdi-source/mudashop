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
      data: { subtotal: 2500, total: 2400, discountTotal: 100 },
    });
  });

  it("کادوپیچ به total اضافه می‌شود ولی subtotal را دست نمی‌زند", async () => {
    const tx = makeTx(makeOrder({ giftWrap: true }));
    await recomputeOrderTotals(tx as never, "order-1");

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 2500, total: 2500 - 100 + GIFT_WRAP_COST, discountTotal: 100 },
    });
  });

  it("discountTotal (کوپن) دست‌نخورده می‌ماند وقتی هنوز از subtotal جدید کمتره", async () => {
    const tx = makeTx(makeOrder({ discountTotal: 250 }));
    await recomputeOrderTotals(tx as never, "order-1");

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 2500, total: 2250, discountTotal: 250 },
    });
  });

  it("رگرسیونِ باگِ واقعی: discountTotal ثابتی که از subtotal جدید (بعد از حذف/کاهش قلم) بیشتره، clamp می‌شه -- total هیچ‌وقت منفی نمی‌مونه", async () => {
    // دقیقاً همون سناریویی که زنده پیدا شد: کوپن ثابتِ ۹۰,۰۰۰، ادمین قلمِ
    // گرون‌تر رو حذف می‌کنه، فقط ۵۰,۰۰۰ باقی می‌مونه -- قبل از فیکس total
    // می‌شد -۴۰,۰۰۰ و سفارش برای همیشه غیرقابل‌پرداخت می‌موند
    const tx = makeTx(
      makeOrder({ discountTotal: 90000, items: [{ price: 50000, quantity: 1, orderId: "order-1" }] })
    );
    await recomputeOrderTotals(tx as never, "order-1");

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 50000, total: 0, discountTotal: 50000 },
    });
  });

  it("اقلام خالی => subtotal و total صفر (discountTotal هم به صفر clamp می‌شه)", async () => {
    const tx = makeTx(makeOrder({ items: [], total: 999 }));
    await recomputeOrderTotals(tx as never, "order-1");

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 0, total: 0, discountTotal: 0 },
    });
  });

  it("هزینه‌ی ارسالِ فعلی داخل total حفظ می‌شود (اینورینت finalize)", async () => {
    const tx = makeTx(makeOrder({ shippingCost: 45000 }));
    await recomputeOrderTotals(tx as never, "order-1");

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { subtotal: 2500, total: 2400 + 45000, discountTotal: 100 },
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
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { adjustVariantStockForQuantityChange, restoreOrderResources } from "@/lib/orderResources";

const walletTx = vi.hoisted(() => ({ applyWalletTransaction: vi.fn() }));
vi.mock("@/lib/wallet", () => walletTx);

// اقلام واقعیِ OrderItem را ساده می‌کنیم: فقط فیلدهای مصرف‌شده توسط orderResources
type Item = { variantId: string | null; flashSaleId: string | null; quantity: number };
type Order = {
  id: string;
  userId: string;
  couponCode: string | null;
  walletUsed: number;
  items: Item[];
};

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: "order-12345678",
    userId: "user-1",
    couponCode: null,
    walletUsed: 0,
    items: [],
    ...overrides,
  };
}

// تابع فقط فیلدهای بالا را می‌خواند؛ بقیه‌ی Payload کاملِ پرایسما برای تست لازم نیست.
// این کست عمداً صریح است تا بتوان تابع را بدون سِت‌آپ DB صدا زد.
type OrderLike = Parameters<typeof restoreOrderResources>[1];
const orderLike = (order: Order): OrderLike => order as unknown as OrderLike;

describe("restoreOrderResources -- بازگردانی منابع رزروشده هنگام لغو/شکست پرداخت", () => {
  it("موجودی variant و فلش‌سیلِ هر قلم به اندازه‌ی تعداد برمی‌گردد", async () => {
    const ops: { model: string; data: unknown }[] = [];
    const tx = {
      productVariant: {
        update: async (args: { data: unknown }) => {
          ops.push({ model: "variant", data: args.data });
          return undefined;
        },
      },
      flashSale: {
        update: async (args: { data: unknown }) => {
          ops.push({ model: "flashSale", data: args.data });
          return undefined;
        },
      },
      coupon: {
        updateMany: async (args: { data: unknown }) => {
          ops.push({ model: "coupon", data: args.data });
          return undefined;
        },
      },
      walletTransaction: { create: async () => undefined },
      firstBuyClaim: { deleteMany: async () => undefined },
    } as unknown as Prisma.TransactionClient;

    await restoreOrderResources(
      tx,
      orderLike(
        makeOrder({
          items: [
            { variantId: "v1", flashSaleId: null, quantity: 2 },
            { variantId: "v2", flashSaleId: "f1", quantity: 3 },
          ],
        })
      )
    );

    expect(ops).toEqual([
      { model: "variant", data: { stock: { increment: 2 } } },
      { model: "variant", data: { stock: { increment: 3 } } },
      { model: "flashSale", data: { stock: { increment: 3 } } },
    ]);
  });

  it("کوپنِ مصرف‌شده‌ی سفارش یک واحد برمی‌گردد", async () => {
    const couponCalls: { where: unknown; data: unknown }[] = [];
    const tx = {
      productVariant: { update: async () => undefined },
      flashSale: { update: async () => undefined },
      coupon: {
        updateMany: async (args: { where: unknown; data: unknown }) => {
          couponCalls.push(args);
          return { count: 1 };
        },
      },
      walletTransaction: { create: async () => undefined },
      firstBuyClaim: { deleteMany: async () => undefined },
    } as unknown as Prisma.TransactionClient;

    await restoreOrderResources(tx, orderLike(makeOrder({ couponCode: "WELCOME10", items: [] })));

    expect(couponCalls).toEqual([
      {
        where: { code: "WELCOME10", usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      },
    ]);
  });

  it("مبلغ کسرشده از کیف پول به‌صورت REFUND برگردانده می‌شود", async () => {
    const tx = {
      productVariant: { update: async () => undefined },
      flashSale: { update: async () => undefined },
      coupon: { updateMany: async () => ({ count: 0 }) },
      walletTransaction: { create: async () => undefined },
      firstBuyClaim: { deleteMany: async () => undefined },
    } as unknown as Prisma.TransactionClient;

    await restoreOrderResources(tx, orderLike(makeOrder({ walletUsed: 250_000, couponCode: null, items: [] })));

    expect(walletTx.applyWalletTransaction).toHaveBeenCalledWith(tx, {
      userId: "user-1",
      amount: 250_000,
      type: "REFUND",
      description: "بازگشت وجه سفارش #12345678",
      orderId: "order-12345678",
    });
  });

  it("سفارش بدون variant/فلش‌سیل/کوپن/کیف‌پول هیچ عملیاتی نمی‌زند", async () => {
    let updates = 0;
    const tx = {
      productVariant: { update: async () => void updates++ },
      flashSale: { update: async () => void updates++ },
      coupon: { updateMany: async () => ({ count: 0 }) },
      walletTransaction: { create: async () => undefined },
      firstBuyClaim: { deleteMany: async () => undefined },
    } as unknown as Prisma.TransactionClient;

    await restoreOrderResources(tx, orderLike(makeOrder({})));
    expect(updates).toBe(0);
  });
});

describe("adjustVariantStockForQuantityChange -- تنظیم موجودی با اختلاف تعداد", () => {
  it("delta=0 یعنی هیچ کاری نکن", async () => {
    let calls = 0;
    const tx = {
      productVariant: {
        findUnique: async () => {
          calls++;
          return null;
        },
        update: async () => void calls++,
      },
    } as unknown as Prisma.TransactionClient;

    await expect(adjustVariantStockForQuantityChange(tx, "v1", 0)).resolves.toBeUndefined();
    expect(calls).toBe(0);
  });

  it("تعدادِ زیادشده باید از موجودی کسر شود (چک کافی بودن)", async () => {
    const tx = {
      productVariant: {
        findUnique: async () => ({ id: "v1", stock: 5 }),
        update: async (args: unknown) => args,
      },
    } as unknown as Prisma.TransactionClient;
    const spy = vi.spyOn(tx.productVariant, "update" as never);

    await adjustVariantStockForQuantityChange(tx, "v1", 4);
    expect(spy).toHaveBeenCalledWith({ where: { id: "v1" }, data: { stock: { decrement: 4 } } });
  });

  it("موجودی کافی نباشد خطای فارسی می‌دهد و update نمی‌زند", async () => {
    let updateCalls = 0;
    const tx = {
      productVariant: {
        findUnique: async () => ({ id: "v1", stock: 2 }),
        update: async () => {
          updateCalls++;
          return undefined;
        },
      },
    } as unknown as Prisma.TransactionClient;

    await expect(adjustVariantStockForQuantityChange(tx, "v1", 3)).rejects.toThrow(
      "موجودی کافی برای این تعداد وجود ندارد"
    );
    expect(updateCalls).toBe(0);
  });

  it("تعدادِ کمترشده باید به موجودی برگردد", async () => {
    const tx = {
      productVariant: {
        findUnique: async () => ({ id: "v1", stock: 5 }),
        update: async (args: unknown) => args,
      },
    } as unknown as Prisma.TransactionClient;
    const spy = vi.spyOn(tx.productVariant, "update" as never);

    await adjustVariantStockForQuantityChange(tx, "v1", -2);
    expect(spy).toHaveBeenCalledWith({ where: { id: "v1" }, data: { stock: { increment: 2 } } });
  });
});
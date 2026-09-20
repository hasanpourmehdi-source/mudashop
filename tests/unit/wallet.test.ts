import { describe, expect, it, vi } from "vitest";
import { applyWalletTransaction } from "@/lib/wallet";

type Wallet = { id: string; userId: string; balance: number };

type ClientMock = {
  wallet: {
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  walletTransaction: { create: ReturnType<typeof vi.fn> };
};

function makeClient(wallet: Wallet | null): ClientMock {
  let current: Wallet | null = wallet;
  return {
    wallet: {
      findUnique: vi.fn().mockImplementation(async () => current),
      findUniqueOrThrow: vi.fn().mockImplementation(async () => {
        if (!current) throw new Error("NotFound");
        return current;
      }),
      create: vi
        .fn()
        .mockImplementation(async (args: { data: { userId: string; balance: number } }) => {
          current = { id: `w-${args.data.userId}`, userId: args.data.userId, balance: args.data.balance };
          return current;
        }),
      update: vi.fn().mockImplementation((args: { where: { id: string }; data: { balance: { increment?: number; decrement?: number } } }) => {
        const delta = args.data.balance.increment ?? -args.data.balance.decrement!;
        current = { ...current!, balance: current!.balance + delta };
        return current;
      }),
      updateMany: vi.fn().mockImplementation(async (args: { where: { id: string; balance?: { gte: number } }; data: { balance: { decrement: number } } }) => {
        if (args.where.balance?.gte != null && current!.balance < args.where.balance.gte) {
          return { count: 0 };
        }
        current = { ...current!, balance: current!.balance - args.data.balance.decrement };
        return { count: 1 };
      }),
    },
    walletTransaction: { create: vi.fn().mockResolvedValue({}) },
  } as unknown as ClientMock;
}

describe("applyWalletTransaction", () => {
  it("TOPUP موجودی را زیاد می‌کند و تراکنش می‌سازد", async () => {
    const client = makeClient({ id: "w1", userId: "u1", balance: 100 });
    const result = await applyWalletTransaction(client as never, {
      userId: "u1",
      amount: 500,
      type: "TOPUP",
      description: "شارژ",
    });

    expect(client.wallet.update).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { balance: { increment: 500 } },
    });
    expect(client.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletId: "w1",
          type: "TOPUP",
          amount: 500,
          description: "شارژ",
        }),
      })
    );
    expect(result.balance).toBe(600);
  });

  it("PURCHASE موجودی را کم می‌کند", async () => {
    const client = makeClient({ id: "w1", userId: "u1", balance: 1000 });
    const result = await applyWalletTransaction(client as never, {
      userId: "u1",
      amount: 300,
      type: "PURCHASE",
      description: "خرید",
    });

    expect(client.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: "w1", balance: { gte: 300 } },
      data: { balance: { decrement: 300 } },
    });
    expect(result.balance).toBe(700);
  });

  it("REFUND مانند واریز عمل می‌کند", async () => {
    const client = makeClient({ id: "w1", userId: "u1", balance: 0 });
    const result = await applyWalletTransaction(client as never, {
      userId: "u1",
      amount: 200,
      type: "REFUND",
      description: "بازگشت",
    });

    expect(client.wallet.update).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { balance: { increment: 200 } },
    });
    expect(result.balance).toBe(200);
  });

  it("برداشت بیش از موجودی، خطای فارسی می‌دهد و update نمی‌زند", async () => {
    const client = makeClient({ id: "w1", userId: "u1", balance: 100 });
    await expect(
      applyWalletTransaction(client as never, {
        userId: "u1",
        amount: 150,
        type: "WITHDRAWAL",
        description: "برداشت",
      })
    ).rejects.toThrow("موجودی کیف پول کافی نیست");

    expect(client.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: "w1", balance: { gte: 150 } },
      data: { balance: { decrement: 150 } },
    });
    expect(client.walletTransaction.create).not.toHaveBeenCalled();
  });

  it("اگر کیف پول نباشد، اول ساخته می‌شود", async () => {
    const client = makeClient(null);
    await applyWalletTransaction(client as never, {
      userId: "u1",
      amount: 50,
      type: "TOPUP",
      description: "شارژ اولیه",
    });

    expect(client.wallet.create).toHaveBeenCalledWith({
      data: { userId: "u1", balance: 0 },
    });
    expect(client.wallet.update).toHaveBeenCalled();
  });

  it("orderId به تراکنش منتقل می‌شود", async () => {
    const client = makeClient({ id: "w1", userId: "u1", balance: 500 });
    await applyWalletTransaction(client as never, {
      userId: "u1",
      amount: 100,
      type: "REFUND",
      description: "لغو سفارش",
      orderId: "order-1",
    });

    expect(client.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: "order-1" }),
      })
    );
  });

  it("موجودی کافی، WITHDRAWAL را انجام می‌دهد", async () => {
    const client = makeClient({ id: "w1", userId: "u1", balance: 500 });
    const result = await applyWalletTransaction(client as never, {
      userId: "u1",
      amount: 500,
      type: "WITHDRAWAL",
      description: "برداشت کامل",
    });
    expect(result.balance).toBe(0);
  });
});
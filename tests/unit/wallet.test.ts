import { describe, expect, it, vi } from "vitest";
import { applyWalletTransaction } from "@/lib/wallet";

type Wallet = { id: string; userId: string; balance: number };

type ClientMock = {
  wallet: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  walletTransaction: { create: ReturnType<typeof vi.fn> };
};

function makeClient(wallet: Wallet | null): ClientMock {
  let current: Wallet | null = wallet;
  return {
    wallet: {
      findUnique: vi.fn().mockImplementation(async () => current),
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
    },
    walletTransaction: { create: vi.fn().mockResolvedValue({}) },
  };
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

    expect(client.wallet.update).toHaveBeenCalledWith({
      where: { id: "w1" },
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

    expect(client.wallet.update).not.toHaveBeenCalled();
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
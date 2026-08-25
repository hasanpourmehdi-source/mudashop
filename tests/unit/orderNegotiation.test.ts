import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { markAwaitingAdminReview, markAwaitingCustomerReview } from "@/lib/orderNegotiation";

// قرارداد رفتاریِ مذاکره‌ی اقلام: مهم‌ترین بخش، idempotency است -- اگه سفارش
// از قبل در همان حالتِ انتظار باشد، نباید اعلان تکراری بفرستد.

async function markCustomer(
  initialNegotiationStatus: string,
  reason?: string
): Promise<{
  updates: unknown[];
  histories: unknown[];
  notifications: unknown[];
}> {
  const updates: unknown[] = [];
  const histories: unknown[] = [];
  const notifications: unknown[] = [];
  const tx = {
    order: {
      findUniqueOrThrow: async () => ({ id: "order-1", itemsNegotiationStatus: initialNegotiationStatus, userId: "user-1", status: "PROCESSING" }),
      update: async (args: unknown) => {
        updates.push(args);
        return undefined;
      },
    },
    orderStatusHistory: {
      create: async (args: unknown) => {
        histories.push(args);
        return undefined;
      },
    },
    notification: {
      create: async (args: unknown) => {
        notifications.push(args);
        return undefined;
      },
    },
  } as unknown as Prisma.TransactionClient;

  await markAwaitingCustomerReview(tx, "order-1", reason);
  return { updates, histories, notifications };
}

describe("markAwaitingCustomerReview", () => {
  it("وقتی هنوز منتظر نبود، status عوض و اعلان می‌شود", async () => {
    const { updates, histories, notifications } = await markCustomer("NONE");
    expect(updates).toEqual([
      { where: { id: "order-1" }, data: { itemsNegotiationStatus: "AWAITING_CUSTOMER_REVIEW" } },
    ]);
    expect(histories).toHaveLength(1);
    expect(notifications).toHaveLength(1);
  });

  it("عامل دوم در متن اعلان و تاریخچه می‌آید", async () => {
    const { histories, notifications } = await markCustomer("NONE", "این کالا ناموجود شد");
    expect((notifications[0] as { data: { userId: string; link: string } }).data).toMatchObject({
      userId: "user-1",
      link: "/orders/order-1",
    });
    expect(JSON.stringify(notifications[0])).toContain("این کالا ناموجود شد");
    expect(JSON.stringify(histories[0])).toContain("این کالا ناموجود شد");
  });

  it("idempotent: اگه از قبل منتظر بود، نه update نه notification تکراری -- ولی تاریخچه ثبت می‌شود", async () => {
    const { updates, histories, notifications } = await markCustomer("AWAITING_CUSTOMER_REVIEW");
    expect(updates).toEqual([]);
    expect(notifications).toEqual([]);
    expect(histories).toHaveLength(1);
    // پیام پیش‌فرض وقتی reason داده نشده
    expect(JSON.stringify(histories[0])).toContain("منتظر تأیید شما روی تغییرات اقلام سفارش");
  });
});

async function markAdmin(
  initialNegotiationStatus: string,
  admins: { id: string }[] = [{ id: "admin-1" }, { id: "admin-2" }]
): Promise<{
  updates: unknown[];
  createManyCalls: unknown[];
}> {
  const updates: unknown[] = [];
  const createManyCalls: unknown[] = [];
  const tx = {
    order: {
      findUniqueOrThrow: async () => ({ id: "order-1", itemsNegotiationStatus: initialNegotiationStatus }),
      update: async (args: unknown) => {
        updates.push(args);
        return undefined;
      },
    },
    user: {
      findMany: async () => admins,
    },
    notification: {
      createMany: async (args: unknown) => {
        createManyCalls.push(args);
        return { count: admins.length };
      },
    },
  } as unknown as Prisma.TransactionClient;

  await markAwaitingAdminReview(tx, "order-1");
  return { updates, createManyCalls };
}

describe("markAwaitingAdminReview", () => {
  it("وضعیت و respondedAt را به‌روز می‌کند و به همه‌ی ادمین‌ها اعلان می‌دهد", async () => {
    const { updates, createManyCalls } = await markAdmin("NONE");
    expect(updates).toHaveLength(1);
    const update = updates[0] as { data: { itemsNegotiationStatus: string; itemsNegotiationRespondedAt: Date } };
    expect(update.data.itemsNegotiationStatus).toBe("AWAITING_ADMIN_REVIEW");
    expect(update.data.itemsNegotiationRespondedAt).toBeInstanceOf(Date);

    expect(createManyCalls).toHaveLength(1);
    const create = createManyCalls[0] as { data: { userId: string; link: string }[] };
    expect(create.data).toHaveLength(2);
    expect(create.data[0]).toMatchObject({ userId: "admin-1", link: "/admin/orders/order-1" });
  });

  it("idempotent: اگه از قبل AWAITING_ADMIN_REVIEW بود، هیچ کاری نمی‌کند", async () => {
    const { updates, createManyCalls } = await markAdmin("AWAITING_ADMIN_REVIEW");
    expect(updates).toEqual([]);
    expect(createManyCalls).toEqual([]);
  });

  it("وقتی ادمینی نباشد اعلان بی‌اثر است (بدون خطا)", async () => {
    const { updates, createManyCalls } = await markAdmin("NONE", []);
    expect(updates).toHaveLength(1);
    expect(createManyCalls).toEqual([]);
  });
});
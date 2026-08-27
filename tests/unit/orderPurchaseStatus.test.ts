// پوشش Gherkin: 04-purchase-tracking.feature, 06-item-final-outcome.feature
import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  cascadeCancelIfAllVoided,
  computePurchaseSummary,
  notifyIfAllArrived,
  PURCHASE_OUTCOME_LABELS,
  type PurchaseTrackedItem,
} from "@/lib/orderPurchaseStatus";

const tr = (purchaseStatus: string, quantity = 1): PurchaseTrackedItem => ({
  source: "TRENDYOL",
  purchaseStatus,
  quantity,
});
const mazon = (purchaseStatus = "PENDING"): PurchaseTrackedItem => ({
  source: "MAZON",
  purchaseStatus,
  quantity: 1,
});

describe("computePurchaseSummary", () => {
  it("هیچ قلمی: همه صفر؛ pending صفر است پس allResolved=true ولی allArrived=false", () => {
    const s = computePurchaseSummary([]);
    expect(s).toMatchObject({ total: 0, purchased: 0, cancelled: 0, pending: 0, allResolved: true, allArrived: false, allCancelled: false });
  });

  it("فقط اقلام مزون در نظر گرفته نمی‌شوند", () => {
    expect(computePurchaseSummary([mazon()]).total).toBe(0);
  });

  it("حالت مختلط: purchased شامل PURCHASED و RECEIVED است (TC-4.5)", () => {
    const s = computePurchaseSummary([tr("PURCHASED"), tr("CANCELLED"), tr("PENDING")]);
    expect(s).toMatchObject({ total: 3, purchased: 1, cancelled: 1, pending: 1, allResolved: false, allCancelled: false, allArrived: false });
  });

  it("PURCHASED-like (RECEIVED/LOST/...) جزو purchased حساب می‌شوند", () => {
    const s = computePurchaseSummary([tr("RECEIVED"), tr("LOST"), tr("WRONG_SIZE")]);
    expect(s.purchased).toBe(3);
  });

  it("allCancelled فقط وقتی همه‌شان CANCELLED باشند (TC-4.6)", () => {
    expect(computePurchaseSummary([tr("CANCELLED"), tr("CANCELLED")]).allCancelled).toBe(true);
    expect(computePurchaseSummary([tr("CANCELLED"), tr("RECEIVED")]).allCancelled).toBe(false);
  });

  it("allArrived وقتی همه در وضعیت terminal باشند؛ AWAITING_CUSTOMER_DECISION مانع است", () => {
    expect(computePurchaseSummary([tr("RECEIVED"), tr("LOST")]).allArrived).toBe(true);
    expect(computePurchaseSummary([tr("PURCHASED"), tr("RECEIVED")]).allArrived).toBe(false);
    expect(computePurchaseSummary([tr("AWAITING_CUSTOMER_DECISION"), tr("RECEIVED")]).allArrived).toBe(false);
  });

  it("allVoided فقط وقتی همه‌ی اقلام یه نتیجه‌ی رفاندی داشته باشن -- یه RECEIVED کافیه که false بشه", () => {
    expect(computePurchaseSummary([tr("CANCELLED"), tr("LOST")]).allVoided).toBe(true);
    expect(computePurchaseSummary([tr("CANCELLED"), tr("WRONG_SIZE"), tr("ISSUE_OTHER")]).allVoided).toBe(true);
    expect(computePurchaseSummary([tr("CANCELLED"), tr("RECEIVED")]).allVoided).toBe(false);
    expect(computePurchaseSummary([tr("LOST"), tr("PURCHASED")]).allVoided).toBe(false);
    expect(computePurchaseSummary([tr("LOST"), tr("AWAITING_CUSTOMER_DECISION")]).allVoided).toBe(false);
    expect(computePurchaseSummary([]).allVoided).toBe(false);
  });
});

describe("cascadeCancelIfAllVoided -- رگرسیونِ باگِ واقعی: سفارشی که تنها قلمش گم/مغایرت‌دار شد برای همیشه معلق نمی‌ماند", () => {
  function fakeTx() {
    const orderUpdates: unknown[] = [];
    const historyNotes: string[] = [];
    const couponUpdates: unknown[] = [];
    const tx = {
      order: {
        update: async (args: unknown) => {
          orderUpdates.push(args);
          return undefined;
        },
      },
      orderStatusHistory: {
        create: async (args: { data: { note: string } }) => {
          historyNotes.push(args.data.note);
          return undefined;
        },
      },
      coupon: {
        updateMany: async (args: unknown) => {
          couponUpdates.push(args);
          return undefined;
        },
      },
    } as unknown as Prisma.TransactionClient;
    return { tx, orderUpdates, historyNotes, couponUpdates };
  }

  it("سفارشِ کاملاً-خارجی که همه‌ی اقلامش رفاندی شدن (نه فقط CANCELLED فاز-۱، شاملِ LOST هم) لغو می‌شه", async () => {
    const { tx, orderUpdates, historyNotes } = fakeTx();
    const cancelled = await cascadeCancelIfAllVoided(
      tx,
      { id: "order-1", status: "PROCESSING", couponCode: null },
      [tr("LOST"), tr("WRONG_SIZE")]
    );
    expect(cancelled).toBe(true);
    expect(orderUpdates).toEqual([{ where: { id: "order-1" }, data: { status: "CANCELLED" } }]);
    expect(historyNotes[0]).toContain("لغو شد");
  });

  it("اگه حداقل یه قلم RECEIVED باشه (چیزی برای ارسال مونده)، سفارش لغو نمی‌شه", async () => {
    const { tx, orderUpdates } = fakeTx();
    const cancelled = await cascadeCancelIfAllVoided(
      tx,
      { id: "order-1", status: "PROCESSING", couponCode: null },
      [tr("LOST"), tr("RECEIVED")]
    );
    expect(cancelled).toBe(false);
    expect(orderUpdates).toHaveLength(0);
  });

  it("سفارشِ مختلط (مزون+خارجی) حتی وقتی همه‌ی اقلامِ خارجی رفاندی شدن، لغو نمی‌شه (کالای مزون هنوز باید ارسال بشه)", async () => {
    const { tx, orderUpdates } = fakeTx();
    const cancelled = await cascadeCancelIfAllVoided(
      tx,
      { id: "order-1", status: "PROCESSING", couponCode: null },
      [tr("LOST"), mazon("PENDING")]
    );
    expect(cancelled).toBe(false);
    expect(orderUpdates).toHaveLength(0);
  });

  it("کوپن رو هم برمی‌گردونه اگه سفارش کوپن داشته", async () => {
    const { tx, couponUpdates } = fakeTx();
    await cascadeCancelIfAllVoided(tx, { id: "order-1", status: "PROCESSING", couponCode: "SAVE10" }, [
      tr("CANCELLED"),
    ]);
    expect(couponUpdates).toEqual([
      { where: { code: "SAVE10", usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } },
    ]);
  });

  it("سفارشی که از قبل CANCELLED بوده دوباره لغو/دستکاری نمی‌شه (idempotent)", async () => {
    const { tx, orderUpdates } = fakeTx();
    const cancelled = await cascadeCancelIfAllVoided(
      tx,
      { id: "order-1", status: "CANCELLED", couponCode: null },
      [tr("LOST")]
    );
    expect(cancelled).toBe(false);
    expect(orderUpdates).toHaveLength(0);
  });
});

describe("notifyIfAllArrived", () => {
  function fakeTx(createdNotes: string[]) {
    return {
      orderStatusHistory: {
        create: async (args: { data: { note: string } }) => {
          createdNotes.push(args.data.note);
          return undefined;
        },
      },
    } as unknown as Prisma.TransactionClient;
  }

  it("وقتی همه اقلام سالم رسیدند، پیام «به انبار ما رسید» ثبت می‌شود", async () => {
    const notes: string[] = [];
    const result = await notifyIfAllArrived(fakeTx(notes), { id: "order-12345678", status: "PROCESSING" }, [
      tr("RECEIVED"),
      tr("RECEIVED"),
    ]);
    expect(result.allArrived).toBe(true);
    expect(result.message).toContain("به انبار ما رسید");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("به انبار ما رسید");
  });

  it("وقتی در بین اقلام کنسل وجود دارد، پیام جمع‌بندی بدون «رسید» ثبت می‌شود (TC-4.6)", async () => {
    const notes: string[] = [];
    const result = await notifyIfAllArrived(fakeTx(notes), { id: "order-12345678", status: "PROCESSING" }, [
      tr("CANCELLED"),
      tr("RECEIVED"),
    ]);
    expect(result.allArrived).toBe(true);
    expect(result.message).not.toContain("به انبار ما رسید");
  });

  it("تا وقتی هنوز قلم PENDING هست i پیام ثبت نمی‌شود", async () => {
    const notes: string[] = [];
    const result = await notifyIfAllArrived(fakeTx(notes), { id: "order-12345678", status: "PROCESSING" }, [
      tr("PURCHASED"),
    ]);
    expect(result.allArrived).toBe(false);
    expect(notes).toHaveLength(0);
  });
});

describe("PURCHASE_OUTCOME_LABELS", () => {
  it("برای هر نتیجه‌ی نهایی برچسب فارسی دارد", () => {
    expect(PURCHASE_OUTCOME_LABELS.RECEIVED).toBe("رسید");
    expect(PURCHASE_OUTCOME_LABELS.WRONG_SIZE).toContain("سایز");
    expect(PURCHASE_OUTCOME_LABELS.WRONG_COLOR).toContain("رنگ");
    expect(PURCHASE_OUTCOME_LABELS.LOST).toBe("گم شد");
    expect(PURCHASE_OUTCOME_LABELS.ISSUE_OTHER).toBe("مشکل دیگر");
  });
});
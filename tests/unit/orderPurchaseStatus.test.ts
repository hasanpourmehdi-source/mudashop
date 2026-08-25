// پوشش Gherkin: 04-purchase-tracking.feature, 06-item-final-outcome.feature
import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
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
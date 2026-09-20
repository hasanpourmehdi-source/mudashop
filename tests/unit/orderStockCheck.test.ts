import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkTrendyolItemsStock, _resetStockCheckCacheForTests } from "@/lib/orderStockCheck";
import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { fetchTrendyolProductDetail, type TrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";

vi.mock("@/lib/trendyolProductUrlCache", () => ({ getCachedTrendyolProductUrl: vi.fn() }));
vi.mock("@/lib/trendyolProductDetail", () => ({ fetchTrendyolProductDetail: vi.fn() }));
vi.mock("@/lib/trendyolFetchLog", () => ({ logTrendyolFetchFailure: vi.fn() }));

const mockGetUrl = vi.mocked(getCachedTrendyolProductUrl);
const mockFetchDetail = vi.mocked(fetchTrendyolProductDetail);
const mockLogFailure = vi.mocked(logTrendyolFetchFailure);

beforeEach(() => {
  vi.clearAllMocks();
  // کشِ کوتاه‌مدتِ ماژول‌سطح -- بینِ تست‌ها که یه URLِ نمونه‌ی مشترک رو تکرار
  // می‌کنن، نتیجه‌ی یه تستِ قبلی نباید به تستِ بعدی نشت کنه
  _resetStockCheckCacheForTests();
});

describe("checkTrendyolItemsStock -- موجودی اقلام خارجی سفارش", () => {
  it("قلمِ بدون externalId -> inStock=null و هیچ fetch ای نمی‌زند", async () => {
    const result = await checkTrendyolItemsStock([{ id: "i1", externalId: null }]);
    expect(result).toEqual([{ orderItemId: "i1", inStock: null }]);
    expect(mockGetUrl).not.toHaveBeenCalled();
  });

  it("بدون URL کش‌شده -> inStock=null", async () => {
    mockGetUrl.mockResolvedValue(null);
    const result = await checkTrendyolItemsStock([{ id: "i1", externalId: "e1" }]);
    expect(result).toEqual([{ orderItemId: "i1", inStock: null }]);
    expect(mockGetUrl).toHaveBeenCalledWith("e1");
  });

  it("موجودی واقعی از جزئیات محصول برمی‌گردد", async () => {
    mockGetUrl.mockResolvedValue("https://ty.example/urun/e1");
    mockFetchDetail.mockResolvedValue({ inStock: true } as TrendyolProductDetail);
    const result = await checkTrendyolItemsStock([{ id: "i1", externalId: "e1" }]);
    expect(result).toEqual([{ orderItemId: "i1", inStock: true }]);
  });

  it("خطای شبکه -> inStock=null و در لاگ ثبت می‌شود", async () => {
    mockGetUrl.mockResolvedValue("https://ty.example/urun/e1");
    mockFetchDetail.mockRejectedValue(new Error("boom"));
    const result = await checkTrendyolItemsStock([{ id: "i1", externalId: "e1" }]);

    expect(result).toEqual([{ orderItemId: "i1", inStock: null }]);
    expect(mockLogFailure).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://ty.example/urun/e1", source: "order-stock-check" })
    );
  });

  it("جزئیات بدون inStock هم null است (جلوگیری از نمایش غلط «ناموجود»)", async () => {
    mockGetUrl.mockResolvedValue("https://ty.example/urun/e1");
    mockFetchDetail.mockResolvedValue({ inStock: undefined } as unknown as TrendyolProductDetail);
    const result = await checkTrendyolItemsStock([{ id: "i1", externalId: "e1" }]);
    expect(result).toEqual([{ orderItemId: "i1", inStock: null }]);
  });
});
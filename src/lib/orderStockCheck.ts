import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";

export type ItemStockStatus = { orderItemId: string; inStock: boolean | null };

// هر بار که ادمین صفحه‌ی یه سفارشِ «در انتظارِ تأیید» رو باز/رفرش می‌کنه، این
// تابع دوباره برای هر آیتمِ خارجیِ همون سفارش یه اسکرِیپِ زنده می‌زنه --
// موازیه (Promise.all)، ولی رفرش‌های پیاپیِ همون سفارش یعنی همون اسکرِیپ‌ها
// دوباره و دوباره تکرار می‌شن. یه کشِ کوتاه‌مدت (چند دقیقه، دقیقاً همون
// الگویی که برای دیکشنریِ ترجمه هم استفاده شده) این تکرار رو حذف می‌کنه --
// برای «موجود بودن یا نبودن» چند دقیقه کهنگی قابل‌قبوله (تصمیمِ نهاییِ ادمین
// موقعِ تأییدِ سفارش، نه فقط موقعِ نگاه‌کردن به این نشونگر)
const STOCK_CHECK_CACHE_TTL_MS = 2 * 60 * 1000;
const stockCache = new Map<string, { inStock: boolean | null; expiresAt: number }>();

// فقط برای تست‌ها -- بینِ تست‌های جدا که همون URLِ نمونه رو تکرار می‌کنن،
// کشِ ماژول‌سطح نباید نتیجه‌ی تستِ قبلی رو نشت بده
export function _resetStockCheckCacheForTests() {
  stockCache.clear();
}

async function fetchStockCached(url: string): Promise<boolean | null> {
  const cached = stockCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.inStock;
  try {
    const detail = await fetchTrendyolProductDetail(url);
    const inStock = detail?.inStock ?? null;
    stockCache.set(url, { inStock, expiresAt: Date.now() + STOCK_CHECK_CACHE_TTL_MS });
    return inStock;
  } catch (err) {
    await logTrendyolFetchFailure({ url, error: String(err), source: "order-stock-check" });
    return null;
  }
}

// فقط توی سطح کل محصول (نه رنگ/سایز مشخص -- که دیتای موجودی جداگانه‌ای براش
// نگه نمی‌داریم) چک می‌کنه؛ برای اقلام قدیمی/دموی ترندیول (بدون URL کش‌شده)
// یا هر خطای شبکه، inStock=null برمی‌گرده تا اشتباهی «ناموجود» نشون داده نشه
export async function checkTrendyolItemsStock(
  items: { id: string; externalId: string | null }[]
): Promise<ItemStockStatus[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.externalId) return { orderItemId: item.id, inStock: null };
      const url = await getCachedTrendyolProductUrl(item.externalId);
      if (!url) return { orderItemId: item.id, inStock: null };
      const inStock = await fetchStockCached(url);
      return { orderItemId: item.id, inStock };
    })
  );
}

import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";

export type ItemStockStatus = { orderItemId: string; inStock: boolean | null };

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
      try {
        const detail = await fetchTrendyolProductDetail(url);
        return { orderItemId: item.id, inStock: detail?.inStock ?? null };
      } catch (err) {
        await logTrendyolFetchFailure({ url, error: String(err), source: "order-stock-check" });
        return { orderItemId: item.id, inStock: null };
      }
    })
  );
}

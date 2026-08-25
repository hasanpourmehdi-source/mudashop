// «خرید مجدد سریع» -- تبدیل اقلام یک سفارش قبلی به اقلام سبد با قیمت/موجودیِ
// فعلی. خالص و بدون DB -- برای تست. منطق قیمت دقیقاً همان normalizeMazonProduct
// است (حراج فلش جایگزین تخفیف عادی می‌شود، نه جمع با آن).
export type ReorderOrderItem = {
  title: string;
  quantity: number;
  productId: string | null;
  variantId: string | null;
  image: string | null;
};

export type ReorderProduct = {
  id: string;
  title: string;
  slug: string;
  basePrice: number;
  discount: number;
  fastShipping: boolean;
  images: string;
};

export type ReorderVariant = {
  id: string;
  stock: number;
  priceDiff: number;
  values: { attribute: string; value: string }[];
};

export type ReorderFlash = {
  id: string;
  productId: string;
  discountPercent: number;
};

export type ReorderCartItem = {
  id: string;
  source: "MAZON";
  productId: string;
  variantId?: string;
  flashSaleId?: string;
  title: string;
  image: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  variantLabel?: string;
  maxStock?: number;
  fastShipping: boolean;
};

export function buildReorderCartItems({
  items,
  products,
  variants,
  flashSales,
}: {
  items: ReorderOrderItem[];
  products: ReorderProduct[];
  variants: ReorderVariant[];
  flashSales: ReorderFlash[];
}): { cartItems: ReorderCartItem[]; skipped: string[] } {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const flashByProduct = new Map(flashSales.map((f) => [f.productId, f]));

  const cartItems: ReorderCartItem[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    if (!item.productId) {
      skipped.push(item.title);
      continue;
    }
    const product = productMap.get(item.productId);
    if (!product) {
      skipped.push(item.title);
      continue;
    }
    const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
    if (item.variantId && !variant) {
      skipped.push(item.title);
      continue;
    }
    if (variant && variant.stock <= 0) {
      skipped.push(item.title);
      continue;
    }

    const flash = flashByProduct.get(product.id);
    const effectiveDiscount = flash ? flash.discountPercent : product.discount;
    const basePrice = Math.round(product.basePrice * (1 - effectiveDiscount / 100));
    const price = basePrice + (variant?.priceDiff ?? 0);

    let images: string[];
    try {
      const arr = JSON.parse(product.images);
      images = Array.isArray(arr) ? arr : [product.images];
    } catch {
      images = [product.images];
    }

    cartItems.push({
      id: `${product.id}${variant ? "-" + variant.id : ""}`,
      source: "MAZON",
      productId: product.slug,
      variantId: variant?.id,
      flashSaleId: flash?.id,
      title: product.title,
      image: images[0] ?? item.image ?? "",
      price,
      originalPrice: effectiveDiscount > 0 ? product.basePrice + (variant?.priceDiff ?? 0) : undefined,
      quantity: item.quantity,
      variantLabel: variant?.values.map((v) => `${v.attribute}: ${v.value}`).join(" / ") || undefined,
      maxStock: variant?.stock,
      fastShipping: product.fastShipping,
    });
  }

  return { cartItems, skipped };
}
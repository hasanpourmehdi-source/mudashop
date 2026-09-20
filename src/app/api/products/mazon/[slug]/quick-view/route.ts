import { NextResponse } from "next/server";
import { fetchMazonProductBySlug, fetchSizeGuideImage } from "@/lib/products";
import { parseVariantMeasurements } from "@/lib/productMeasurements";

// دقیقاً همون داده‌ای که صفحه‌ی کاملِ محصول برای AddToCartForm آماده می‌کنه --
// برای مودالِ «نگاه سریع» (src/components/MazonQuickView.tsx) که همون فرم رو
// بدونِ رفتن به صفحه‌ی جدا نشون می‌ده
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await fetchMazonProductBySlug(slug);
  if (!product) {
    return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });
  }

  const sizeGuideImage = await fetchSizeGuideImage(product.categoryId, product.brandId);

  return NextResponse.json({
    id: product.id,
    slugOrId: product.slugOrId,
    title: product.title,
    image: product.image,
    images: product.images,
    price: product.price,
    originalPrice: product.originalPrice,
    discount: product.discount,
    fastShipping: product.fastShipping,
    flashSaleId: product.flashSale?.id ?? null,
    variants: product.variants.map((v) => ({
      id: v.id,
      stock: v.stock,
      priceDiff: v.priceDiff,
      values: v.values.map((val) => ({ attribute: val.attribute, value: val.value })),
      measurements: parseVariantMeasurements(v.measurements),
    })),
    attributeGroupMap: product.attributeGroupMap,
    colorImages: product.colorImages,
    sizeGuideImage: sizeGuideImage?.imageUrl ?? null,
    sizeGuideId: sizeGuideImage?.id ?? null,
  });
}

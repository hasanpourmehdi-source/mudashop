// JSON-LD Schema.org Product -- برای شناخت بهتر محصول در نتایج گوگل
export function ProductJsonLd({
  product,
  url,
}: {
  product: {
    id: string;
    title: string;
    description?: string;
    images: string[];
    brand?: string | null;
    price: number;
    originalPrice?: number;
    discount?: number;
    rating?: number;
    reviewCount?: number;
    categoryName?: string;
  };
  url: string;
}) {
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    price: product.price,
    priceCurrency: "IRR",
    url,
    availability: "https://schema.org/InStock",
    priceValidUntil: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  };
  if (product.originalPrice && product.originalPrice > product.price) {
    offers.price = product.price;
    offers.priceSpecification = {
      "@type": "PriceSpecification",
      price: product.price,
      priceCurrency: "IRR",
    };
  }

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.images,
    sku: product.id,
    description: product.description ? product.description.slice(0, 500) : undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers,
    ...(product.categoryName ? { category: product.categoryName } : {}),
    ...(product.rating !== undefined && product.rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating.toFixed(1),
            reviewCount: product.reviewCount ?? 0,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };

  // فقط مقادیر تعریف‌شده در JSON-LD باشند
  for (const key of Object.keys(jsonLd)) {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
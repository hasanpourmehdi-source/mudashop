import { SITE_URL } from "@/lib/seo";

// JSON-LD سازمان/وب‌سایت -- تزریق در سراسر سایت برای شناخت موتورهای جستجو
export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: "مُداشاپ",
    url: SITE_URL,
    image: `${SITE_URL}/icons/icon-512.png`,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/products?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
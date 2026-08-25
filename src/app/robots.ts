import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// robots.txt -- صفحات حریم خصوصی/پنل ادمین از خزش خارج می‌شوند
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/auth/",
          "/orders/",
          "/wallet",
          "/profile",
          "/messages",
          "/loyalty",
          "/cart",
          "/wishlist",
          "/checkout",
          "/payment/",
        ],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
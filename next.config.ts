import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // got-scraping (و وابسته‌ش header-generator) فایل‌های داده‌ی JSON رو با مسیر
  // نسبی به __dirname خودشون می‌خونن (مثل data_files/headers-order.json). اگه
  // Turbopack/webpack این پکیج‌ها رو باندل کنه، مسیر __dirname عوض می‌شه و این
  // فایل‌ها دیگه پیدا نمی‌شن (ENOENT). با serverExternalPackages می‌گیم این‌ها
  // رو باندل نکنه و بذاره Node.js عادی از node_modules لودشون کنه.
  serverExternalPackages: ["got-scraping", "header-generator"],
};

export default nextConfig;

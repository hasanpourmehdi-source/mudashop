import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // اسکریپت‌های Node ساده (seed/prisma و scripts) با require نوشته شدن و با
      // قوانین next/typescript سازگار نیستن -- lint نمی‌شن (این‌ها فقط ابزار
      // توسعه‌ان، نه بخشی از سورس فرانت‌اند)
      "prisma/**",
      "scripts/**",
    ],
  },
];

export default eslintConfig;

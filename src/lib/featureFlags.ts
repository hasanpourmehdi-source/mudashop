import { cache } from "react";
import { getSiteSettings } from "@/lib/siteSettings";
import { FEATURE_CATALOG } from "@/lib/featureCatalog";

export { FEATURE_CATALOG };

// هم layoutِ ریشه هم بعضی صفحه‌ها (که خودشون هم زیرِ همون layout رندر می‌شن)
// این تابع رو بدونِ آرگومان صدا می‌زنن -- cache() باعث می‌شه توی یه درخواستِ
// واحد فقط یه‌بار به‌جدولِ siteSetting سر بزنه، نه چندبارِ تکراری
export const getFeatureFlags = cache(async (): Promise<Record<string, boolean>> => {
  const raw = await getSiteSettings(FEATURE_CATALOG.map((f) => f.key));
  return Object.fromEntries(FEATURE_CATALOG.map((f) => [f.key, raw[f.key] !== "false"]));
});

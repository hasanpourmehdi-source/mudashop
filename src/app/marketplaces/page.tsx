import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function MarketplacesPage() {
  const sites = await prisma.externalSite.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-1">فروشگاه‌های دیگر</h1>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        این فروشگاه‌ها مستقل از انبار مُداشاپ هستند؛ محصولاتشان مستقیم و زنده از سایت خودشان
        واکشی می‌شود.
      </p>

      {sites.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">فعلاً هیچ فروشگاه دیگری متصل نیست.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/marketplaces/${site.slug}`}
              className="border cut-line rounded-xl p-5 text-center bg-white hover:border-[var(--color-wine)] hover:shadow-md transition"
            >
              <p className="font-bold">{site.name}</p>
              <p className="text-xs text-[var(--color-muted)] mt-1" dir="ltr">
                {new URL(site.baseUrl).hostname}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

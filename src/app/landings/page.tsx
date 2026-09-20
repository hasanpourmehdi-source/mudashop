import Link from "next/link";
import { SEO_LANDINGS } from "@/data/seoLandings";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "کالکشن‌های ویژه | مُداشاپ",
  description: "کالکشن‌های ویژه مُداشاپ: کفش چرم، صندل، کتونی، کیف، عینک و بیشتر -- هر کالکشن با گلچین محصولات و راهنمای خرید.",
};

export default function LandingsPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-2">کالکشن‌های ویژه</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">هر کالکشن با دقت برای یک نیاز خاص گلچین شده -- با متن راهنمای خرید و فیلترِ از پیش‌اعمال‌شده.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SEO_LANDINGS.map((l) => (
          <Link
            key={l.slug}
            href={`/landings/${l.slug}`}
            className="group border cut-line rounded-xl p-5 bg-white hover:shadow-lg transition-shadow"
          >
            <h2 className="font-bold text-lg group-hover:text-[var(--color-wine)] transition-colors">{l.h1}</h2>
            <p className="text-sm text-[var(--color-muted)] mt-1 line-clamp-2">{l.description}</p>
            <span className="inline-block mt-3 text-xs font-bold text-[var(--color-wine)]">مشاهده کالکشن ←</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

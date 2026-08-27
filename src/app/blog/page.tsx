import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "مجله مُداشاپ",
  alternates: { canonical: "/blog" },
};

export default async function BlogListPage() {
  const posts = await prisma.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, slug: true, excerpt: true, coverImage: true, publishedAt: true },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold mb-6">مجله مُداشاپ</h1>

      {posts.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">هنوز پستی منتشر نشده -- به‌زودی برمی‌گردیم.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="border cut-line rounded-xl overflow-hidden bg-white hover:border-[var(--color-wine)] transition-colors"
            >
              {p.coverImage && (
                <div className="relative aspect-video bg-[var(--color-linen-dim)]">
                  <Image src={p.coverImage} alt={p.title} fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-bold mb-1">{p.title}</h2>
                {p.excerpt && <p className="text-sm text-[var(--color-muted)] line-clamp-2">{p.excerpt}</p>}
                {p.publishedAt && (
                  <p className="text-[11px] text-[var(--color-muted)] mt-2">
                    {new Date(p.publishedAt).toLocaleDateString("fa-IR")}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

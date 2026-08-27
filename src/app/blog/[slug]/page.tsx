import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toMetaDescription, siteUrl } from "@/lib/seo";

async function fetchPost(slug: string) {
  return prisma.blogPost.findUnique({ where: { slug } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post || !post.isPublished) return {};
  const description = post.excerpt || toMetaDescription(post.body);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: siteUrl(`/blog/${slug}`),
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post || !post.isPublished) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/blog" className="text-sm text-[var(--color-wine)] hover:underline">
        ‹ مجله مُداشاپ
      </Link>

      <h1 className="text-2xl font-extrabold mt-4 mb-2">{post.title}</h1>
      {post.publishedAt && (
        <p className="text-xs text-[var(--color-muted)] mb-4">{new Date(post.publishedAt).toLocaleDateString("fa-IR")}</p>
      )}

      {post.coverImage && (
        <div className="relative aspect-video bg-[var(--color-linen-dim)] rounded-xl overflow-hidden mb-6">
          <Image src={post.coverImage} alt={post.title} fill className="object-cover" unoptimized priority />
        </div>
      )}

      <div className="text-sm leading-loose whitespace-pre-line text-[var(--color-ink)]">{post.body}</div>
    </div>
  );
}

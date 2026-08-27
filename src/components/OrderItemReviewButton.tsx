"use client";

import { useState } from "react";
import { QuickReviewForm } from "@/components/QuickReviewForm";

// دکمه‌ی «نظر بده» زیر هر قلمِ سفارشِ تحویل‌داده‌شده -- چون از همین‌جا
// productId/externalId دقیقِ همون قلم رو داریم، دیگه نیازی به حدسِ سمتِ سرور
// (که کدوم سایز/رنگ رو مشتری منظورشه) نیست
export function OrderItemReviewButton({
  productId,
  externalId,
  orderItemId,
  title,
  variantLabel,
  image,
  alreadyReviewed,
}: {
  productId?: string;
  externalId?: string;
  orderItemId: string;
  title: string;
  variantLabel?: string | null;
  image?: string | null;
  alreadyReviewed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(alreadyReviewed);

  if (done) {
    return <p className="text-[11px] text-green-700 font-medium">✓ نظر ثبت شده</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs border cut-line rounded-full px-3 py-1 hover:border-[var(--color-wine)]"
      >
        نظر بده
      </button>
    );
  }

  return (
    <QuickReviewForm
      productId={productId}
      externalId={externalId}
      orderItemId={orderItemId}
      title={title}
      variantLabel={variantLabel}
      image={image}
      onSubmitted={() => setDone(true)}
      onCancel={() => setOpen(false)}
    />
  );
}

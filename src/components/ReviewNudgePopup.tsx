"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { OrderItemReviewButton } from "@/components/OrderItemReviewButton";

type PendingItem = {
  id: string;
  source: "MAZON" | "TRENDYOL";
  productId: string | null;
  externalId: string | null;
  title: string;
  image: string | null;
  variantLabel: string | null;
};

const MAX_SHOWN = 3;

// هر بار که کاربر لاگین می‌کنه (یه‌بار در هر نشست مرورگر، نه هر رفرشِ صفحه)،
// اگه از کالاهای تحویل‌گرفته‌ش چیزی هست که هنوز نظر نداده، یه پاپ‌آپ نشونش
// می‌ده تا نظر بده یا با «بعداً» ردش کنه
export function ReviewNudgePopup() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const flagKey = `reviewNudgeShown:${session.user.id}`;
    if (sessionStorage.getItem(flagKey)) return;

    fetch("/api/reviews/pending")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: PendingItem[] }) => {
        if (data.items && data.items.length > 0) {
          setItems(data.items);
          setOpen(true);
        }
        sessionStorage.setItem(flagKey, "1");
      })
      .catch(() => {
        // اتصال بی‌اهمیته -- این فقط یه یادآوریِ کمکیه
      });
  }, [status, session?.user?.id]);

  if (!open || items.length === 0) return null;

  const shown = items.slice(0, MAX_SHOWN);
  const extraCount = items.length - shown.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="یادآوری ثبت نظر"
        className="bg-white rounded-2xl max-w-sm w-full p-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm">نظرت درباره‌ی خریدهای قبلی چیه؟</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="text-[var(--color-muted)]">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {shown.map((item) => (
            <div key={item.id} className="border-b cut-line last:border-0 pb-3 last:pb-0 space-y-2">
              <div className="flex items-center gap-2">
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt={item.title} className="w-10 h-10 rounded-lg object-cover border cut-line shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.variantLabel && <p className="text-[11px] text-[var(--color-muted)]">{item.variantLabel}</p>}
                </div>
              </div>
              <OrderItemReviewButton
                productId={item.productId ?? undefined}
                externalId={item.externalId ?? undefined}
                orderItemId={item.id}
                title={item.title}
                variantLabel={item.variantLabel}
                image={item.image}
                alreadyReviewed={false}
              />
            </div>
          ))}
        </div>

        {extraCount > 0 && (
          <p className="text-[11px] text-[var(--color-muted)] mt-3">
            و {extraCount.toLocaleString("fa-IR")} کالای دیگر -- بقیه رو از صفحه‌ی «سفارش‌های من» می‌تونی نظر بدی.
          </p>
        )}

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--color-muted)] mt-4 w-full text-center"
        >
          بعداً
        </button>
      </div>
    </div>
  );
}

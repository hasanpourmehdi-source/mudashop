"use client";

import { parseTrackingCodes } from "@/lib/trackingCodes";
import { computePurchaseSummary, isPartialPurchase, type PurchaseTrackedItem } from "@/lib/orderPurchaseStatus";
import { trackingUrl } from "@/lib/trackingLink";
import { parsePackageStatuses } from "@/lib/packageStatuses";
import Link from "next/link";
import { useEffect, useState } from "react";

type OrderPackagesProps = {
  trackingCode: string | null;
  items: PurchaseTrackedItem[];
  packageStatuses?: string | null;
};

// اعداد فارسی برای نمایش در UI (کد رهگیری در حالت ltr لاتین می‌ماند)
const FA = "۰۱۲۳۴۵۶۷۸۹";
function faNumber(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA[Number(d)]);
}

function faDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" }).format(new Date(iso));
}

// نشانی وضعیت رسیدنِ هر بسته: در راه (زرد) یا تحویل داده شده ✓ (سبز)
function PackageStatusBadge({ status }: { status: { status: string; arrivedAt: string | null } }) {
  if (status.status === "ARRIVED") {
    return (
      <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 whitespace-nowrap">
        تحویل داده شد{status.arrivedAt ? ` ${faDate(status.arrivedAt)}` : ""} ✓
      </span>
    );
  }
  return (
    <span className="text-[10px] bg-[var(--color-ochre)]/15 text-[var(--color-ochre)] rounded-full px-2 py-0.5 whitespace-nowrap">
      در راه است
    </span>
  );
}

export function OrderPackages({ trackingCode, items, packageStatuses }: OrderPackagesProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1200);
      return () => clearTimeout(t);
    }
  }, [copied]);

  const codes = parseTrackingCodes(trackingCode);
  if (codes.length === 0 && items.length === 0) return null;

  const summary = computePurchaseSummary(items);
  const partialPurchase = isPartialPurchase(summary);

  // وضعیت هر بسته (برای چند کد) -- از آرایه‌ی statuses پیدا می‌شه
  const statusByCode = new Map(parsePackageStatuses(packageStatuses).map((s) => [s.code, s]));
  const hasStatuses = statusByCode.size > 0;

  return (
    <section className="mb-6">
      {codes.length > 1 && (
        <div className="mb-3">
          <h3 className="text-sm font-bold mb-1.5">📦 بسته‌های ارسالی ({faNumber(codes.length)} عدد)</h3>
          <ul className="space-y-1.5 text-sm">
            {codes.map((code, i) => {
              const st = statusByCode.get(code);
              return (
                <li key={`${code}-${i}`} className="flex items-center gap-2">
                  <span className="text-[var(--color-muted)]">بسته {faNumber(i + 1)}:</span>
                  <span dir="ltr" className="font-mono text-xs">
                    {code}
                  </span>
                  {trackingUrl(code) && (
                    <Link
                      href={trackingUrl(code)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-wine)] text-xs underline"
                    >
                      پیگیری
                    </Link>
                  )}
                  {hasStatuses && st && <PackageStatusBadge status={st} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {codes.length === 1 && (
        <div className="mb-3">
          <h3 className="text-sm font-bold mb-1.5">📦 رهگیری بسته</h3>
          <p className="text-sm flex items-center gap-2">
            <span dir="ltr" className="font-mono text-xs">
              {codes[0]}
            </span>
            {trackingUrl(codes[0]) && (
              <Link
                href={trackingUrl(codes[0])!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-wine)] text-xs underline"
              >
                پیگیری
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(codes[0]);
                setCopied(true);
              }}
              aria-label="کپی کد رهگیری"
              className="ml-auto text-[var(--color-muted)] hover:text-[var(--color-wine)]"
              title="کپی"
            >
              📋
            </button>
            {hasStatuses && statusByCode.get(codes[0]) && (
              <PackageStatusBadge status={statusByCode.get(codes[0])!} />
            )}
          </p>
          {copied && <span className="text-[10px] text-green-600">کد رهگیری کپی شد ✓</span>}
        </div>
      )}

      {summary.total > 0 && partialPurchase && (
        <div className="bg-[var(--color-wine)]/5 border border-[var(--color-wine)]/20 rounded-lg p-3 text-sm">
          <span className="font-medium text-[var(--color-wine)]">تحویل جزئی سفارش:</span>
          <span className="block text-xs text-[var(--color-muted)] mt-0.5">
            {summary.purchased > 0
              ? `${faNumber(summary.purchased)} از ${faNumber(summary.total)} قلم شما خریداری شده -- بقیه در حال بررسی/درخواست از ترندیول است`
              : "در حال خرید از ترندیول -- به زودی وضعیت بروزرسانی می‌شود"}
          </span>
        </div>
      )}
    </section>
  );
}

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OrderPackages } from "@/components/OrderPackages";
import { serializePackageStatuses } from "@/lib/packageStatuses";

const trendyolItems = [
  { source: "TRENDYOL", purchaseStatus: "PURCHASED", quantity: 1 },
  { source: "TRENDYOL", purchaseStatus: "PENDING", quantity: 1 },
];

afterEach(() => {
  cleanup();
});

describe("OrderPackages -- نمایش بسته‌ها و تحویل جزئی", () => {
  it("هنگام چند کد رهگیری، لیست بسته‌ها (با شماره بسته) نمایش می‌شود", () => {
    const codes = JSON.stringify(["123456789012", "987654321098"]);
    const { container } = render(<OrderPackages trackingCode={codes} items={[]} />);
    const text = container.textContent;

    expect(text).toContain("بسته ۱");
    expect(text).toContain("بسته ۲");
    expect(text).toContain("۲ عدد");
  });

  it("هنگام یک کد رهگیری، فقط بخش «رهگیری بسته» با یک کد نمایش می‌شود", () => {
    const { container } = render(<OrderPackages trackingCode="123456789012" items={[]} />);
    const text = container.textContent;

    expect(text).toContain("رهگیری بسته");
    expect(text).not.toContain("۲ عدد");
  });

  it("هنگام partial purchase وقتی نه‌همه اقلام خریداری شده‌اند، نکته «تحویل جزئی» نمایش می‌شود", () => {
    const codes = JSON.stringify(["123456789012"]);
    const { container } = render(<OrderPackages trackingCode={codes} items={trendyolItems} />);
    const text = container.textContent;

    expect(text).toContain("تحویل جزئی");
    expect(text).toContain("۱ از ۲ قلم");
  });

  it("هنگام empty trackingCode و بدون اقلام، چیزی رندر نمی‌شود", () => {
    const { container } = render(<OrderPackages trackingCode={null} items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("هنگام allPurchased، نکته تحویل جزئی نشان داده نمی‌شود", () => {
    const codes = JSON.stringify(["123456789012"]);
    const allPurchased = trendyolItems.map((i) => ({ ...i, purchaseStatus: "RECEIVED" }));
    const { container } = render(<OrderPackages trackingCode={codes} items={allPurchased} />);
    const text = container.textContent;

    expect(text).not.toContain("تحویل جزئی");
  });

  it("برای چند بسته، وضعیت رسیدنِ هر کدام (در راه / تحویل شد) نمایش داده می‌شود", () => {
    const codes = JSON.stringify(["A1", "B2"]);
    const statuses = serializePackageStatuses([
      { code: "A1", status: "ARRIVED", arrivedAt: "2026-08-25T10:00:00.000Z" },
      { code: "B2", status: "IN_TRANSIT", arrivedAt: null },
    ]);
    const { container } = render(
      <OrderPackages trackingCode={codes} items={[]} packageStatuses={statuses} />
    );
    const text = container.textContent;

    expect(text).toContain("تحویل داده شد");
    expect(text).toContain("در راه است");
  });

  it("بسته‌ی تحویل‌نشده بدون داده‌ی وضعیت، بج نشان داده نمی‌شود", () => {
    const codes = JSON.stringify(["A1", "B2"]);
    const { container } = render(<OrderPackages trackingCode={codes} items={[]} />);
    const text = container.textContent;

    expect(text).not.toContain("در راه است");
  });
});

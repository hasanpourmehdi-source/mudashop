// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { CustomerOrderItemsReview } from "@/components/CustomerOrderItemsReview";

afterEach(() => {
  cleanup();
});

describe("CustomerOrderItemsReview -- لینک سریع هر قلم به محصول", () => {
  const baseItems = [
    { id: "mazon-1", title: "لباس مزون", price: 100000, quantity: 2, source: "MAZON" as const },
    { id: "tr-1", title: "تیشرت ترندیول", price: 250000, quantity: 1, source: "TRENDYOL" as const },
  ];

  it("قلم مزون با لینک داخلی نمایش داده می‌شود", () => {
    render(
      <CustomerOrderItemsReview
        orderId="o-1"
        items={[{ ...baseItems[0], url: "/products/mazon/top-slug" }]}
        itemsNegotiationStatus="AGREED"
      />
    );
    const link = screen.getByRole("link", { name: /لباس مزون/ });
    expect(link).toHaveAttribute("href", "/products/mazon/top-slug");
    expect(link).not.toHaveAttribute("target");
  });

  it("قلم ترندیول با لینک خارجی در تب جدید باز می‌شود", () => {
    render(
      <CustomerOrderItemsReview
        orderId="o-1"
        items={[{ ...baseItems[1], url: "https://www.trendyol.com/urun/12345" }]}
        itemsNegotiationStatus="AGREED"
      />
    );
    const link = screen.getByRole("link", { name: /تیشرت ترندیول/ });
    expect(link).toHaveAttribute("href", "https://www.trendyol.com/urun/12345");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("بدون url، عنوان به‌صورت متن ساده (بدون لینک) است", () => {
    render(
      <CustomerOrderItemsReview
        orderId="o-1"
        items={[{ ...baseItems[0] }]}
        itemsNegotiationStatus="AGREED"
      />
    );
    expect(screen.queryByRole("link", { name: /لباس مزون/ })).not.toBeInTheDocument();
    expect(screen.getByText("لباس مزون")).toBeInTheDocument();
  });
});
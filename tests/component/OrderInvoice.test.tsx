// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OrderInvoice } from "@/components/OrderInvoice";

afterEach(() => {
  cleanup();
});

describe("OrderInvoice -- لینک فاکتور/پیش‌فاکتور سفارش", () => {
  it("لینکی به نسخه‌ی مستقل و چاپ‌پذیرِ فاکتور نمایش می‌دهد", () => {
    render(<OrderInvoice orderId="order-1234567890" />);

    const link = screen.getByText("مشاهده و چاپ فاکتور");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/orders/order-1234567890/invoice");
  });
});

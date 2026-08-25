// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrackingCodeView } from "@/components/TrackingCodeView";

afterEach(() => {
  cleanup();
});

describe("TrackingCodeView -- کد رهگیری با لینک پیگیری آنلاین", () => {
  it("برای پست، لینک پیگیری به tracking.post.ir دارد", () => {
    render(<TrackingCodeView code="1234567890" shippingMethod="پست پیشتاز" />);
    const link = screen.getByText("پیگیری");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://tracking.post.ir/SearchIndex.aspx?igc=1234567890");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("برای تییپاکس، لینک به tipaxonline است", () => {
    render(<TrackingCodeView code="T123456789" shippingMethod="تیپاکس" />);
    const link = screen.getByText("پیگیری");
    expect(link).toHaveAttribute("href", "https://www.tipaxonline.com/tracking/?trackingcode=T123456789");
  });

  it("برای پیک موتوری (شماره تماس)، لینک پیگیری ندارد", () => {
    render(<TrackingCodeView code="09120000000" shippingMethod="پیک موتوری" />);
    expect(screen.queryByText("پیگیری")).not.toBeInTheDocument();
    expect(screen.getByText("09120000000")).toBeInTheDocument();
  });
});
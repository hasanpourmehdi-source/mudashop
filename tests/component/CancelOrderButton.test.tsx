// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { CancelOrderButton } from "@/components/CancelOrderButton";

function renderButton(overrides: Partial<Parameters<typeof CancelOrderButton>[0]> = {}) {
  return render(
    <CancelOrderButton
      orderId="order-1"
      status="PROCESSING"
      hasExternalItems={false}
      paymentStatus="PENDING"
      {...overrides}
    />
  );
}

// دسترسی به المان‌های فرم پس از بازکردن دیالوگ
function openAndTypeReason() {
  fireEvent.click(screen.getByText("لغو سفارش"));
  const textarea = screen.getByPlaceholderText("دلیل لغو را بنویسید...");
  fireEvent.change(textarea, { target: { value: "نیاز ندارم" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.refresh.mockClear();
});

describe("CancelOrderButton -- قانون لغو سمت مشتری", () => {
  it("برای SHIPPED/DELIVERED/RETURNED هیچ‌چیز رندر نمی‌کند", () => {
    for (const status of ["SHIPPED", "DELIVERED", "RETURNED"]) {
      const { container } = renderButton({ status, paymentStatus: "PAID" });
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });

  it("برای سفارش‌های حاوی کالای خارجی رندر نمی‌شود (لغو مستقیم مخصوص مزون است)", () => {
    const { container } = renderButton({
      status: "PROCESSING",
      hasExternalItems: true,
      paymentStatus: "PAID",
      itemPurchaseStatuses: ["PENDING"],
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("مزونِ در حال پردازش قابل لغو مستقیم است", () => {
    const { container } = renderButton({});
    expect(container).not.toBeEmptyDOMElement();
  });

  it("با کلیک روی دکمه، فرم دلیل باز می‌شود", () => {
    renderButton();
    fireEvent.click(screen.getByText("لغو سفارش"));
    expect(screen.getByPlaceholderText("دلیل لغو را بنویسید...")).toBeInTheDocument();
    expect(screen.getByText("تأیید لغو سفارش")).toBeInTheDocument();
  });

  it("بدون نوشتن دلیل، خطای فارسی نشان می‌دهد و درخواستی نمی‌زند", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderButton();
    fireEvent.click(screen.getByText("لغو سفارش"));
    fireEvent.click(screen.getByText("تأیید لغو سفارش"));

    expect(await screen.findByText("لطفاً دلیل لغو را بنویسید")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("با دلیل، درخواست PATCH درست می‌زند و صفحه refresh می‌شود", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderButton();
    openAndTypeReason();
    fireEvent.click(screen.getByText("تأیید لغو سفارش"));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orders/order-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "cancel", reason: "نیاز ندارم" }),
      })
    );
  });

  it("خطای سرور با متن آن نمایش داده می‌شود", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "سفارش ارسال‌شده قابل لغو نیست" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderButton();
    openAndTypeReason();
    fireEvent.click(screen.getByText("تأیید لغو سفارش"));

    expect(await screen.findByText("سفارش ارسال‌شده قابل لغو نیست")).toBeInTheDocument();
  });
});
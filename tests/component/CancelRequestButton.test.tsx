// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { CancelRequestButton } from "@/components/CancelRequestButton";

function renderButton(overrides: Partial<Parameters<typeof CancelRequestButton>[0]> = {}) {
  return render(
    <CancelRequestButton
      orderId="order-1"
      status="PROCESSING"
      hasExternalItems={true}
      paymentStatus="PAID"
      itemPurchaseStatuses={["PENDING"]}
      existingRequest={null}
      {...overrides}
    />
  );
}

afterEach(() => {
  cleanup();
  router.refresh.mockClear();
});

describe("CancelRequestButton -- درخواست لغو سفارش خارجی", () => {
  it("برای سفارش خارجیِ در صف خرید، دکمه «درخواست لغو» رندر می‌شود", () => {
    const { container } = renderButton();
    expect(screen.getByText("درخواست لغو سفارش")).toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });

  it("برای سفارش مزون (direct) رندر نمی‌شود", () => {
    const { container } = renderButton({
      hasExternalItems: false,
      paymentStatus: "PENDING",
      itemPurchaseStatuses: [],
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("برای سفارش خارجیِ بعد از شروع خرید (PURCHASED) رندر نمی‌شود", () => {
    const { container } = renderButton({ itemPurchaseStatuses: ["PURCHASED"] });
    expect(container).toBeEmptyDOMElement();
  });

  it("با درخواست PENDING، وضعیت «در انتظار بررسی» و دکمه‌ای رندر نمی‌شود", () => {
    renderButton({ existingRequest: { id: "cr-1", status: "PENDING", reason: "دیگه نمی‌خوام", adminNote: null } });
    expect(screen.getByText(/در انتظار بررسی/)).toBeInTheDocument();
    expect(screen.queryByText("درخواست لغو سفارش")).not.toBeInTheDocument();
  });

  it("با درخواست REJECTED، پیام و دکمه‌ی «ثبت درخواست جدید» نمایش داده می‌شود", () => {
    renderButton({ existingRequest: { id: "cr-1", status: "REJECTED", reason: "دلیل", adminNote: "فعلاً وسط خریدیم" } });
    expect(screen.getByText(/درخواست لغو رد شد/)).toBeInTheDocument();
    expect(screen.getByText("پیام ادمین: فعلاً وسط خریدیم")).toBeInTheDocument();
    expect(screen.getByText("ثبت درخواست جدید")).toBeInTheDocument();
  });

  it("بدون نوشتن دلیل، خطای فارسی نشان می‌دهد و درخواستی نمی‌زند", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderButton();
    fireEvent.click(screen.getByText("درخواست لغو سفارش"));
    fireEvent.click(screen.getByText("ثبت درخواست لغو"));

    expect(await screen.findByText("لطفاً دلیل لغو را بنویسید")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("با دلیل، درخواست POST به cancel-request می‌زند و refresh می‌شود", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "cr-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderButton();
    fireEvent.click(screen.getByText("درخواست لغو سفارش"));
    fireEvent.change(screen.getByPlaceholderText("دلیل درخواست لغو را بنویسید..."), {
      target: { value: "دیگه نمی‌خوام" },
    });
    fireEvent.click(screen.getByText("ثبت درخواست لغو"));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orders/order-1/cancel-request",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "دیگه نمی‌خوام" }),
      })
    );
    vi.unstubAllGlobals();
  });
});
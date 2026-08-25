// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountdownTimer } from "@/components/CountdownTimer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CountdownTimer", () => {
  it("بعد از mount مقدار hh:mm:ss را نمایش می‌دهد", () => {
    const endsAt = new Date(Date.now() + 3600_000).toISOString();
    const { container } = render(<CountdownTimer endsAt={endsAt} />);
    expect(container.textContent ?? "").toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("با هر ثانیه، باقی‌مانده کم می‌شود", () => {
    const endsAt = new Date(Date.now() + 3600_000).toISOString();
    const { container } = render(<CountdownTimer endsAt={endsAt} />);
    const before = container.textContent ?? "";

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const after = container.textContent ?? "";
    expect(after).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(after).not.toBe(before);
  });

  it("بعد از انقضا پیام فارسی «حراج تمام شد» را نشان می‌دهد", () => {
    const endsAt = new Date(Date.now() - 1000).toISOString();
    const { container } = render(<CountdownTimer endsAt={endsAt} />);
    expect(container).toHaveTextContent("حراج تمام شد");
  });

  it("className به عنصر ریشه می‌رسد", () => {
    const endsAt = new Date(Date.now() - 1000).toISOString();
    const { container } = render(<CountdownTimer endsAt={endsAt} className="my-countdown" />);
    expect(container.querySelector("span")).toHaveClass("my-countdown");
  });
});
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: React.ReactNode }) =>
    React.createElement("a", { href: typeof href === "string" ? href : null, ...rest }, children),
}));

import { Breadcrumb } from "@/components/Breadcrumb";

afterEach(() => cleanup());

describe("Breadcrumb", () => {
  it("همیشه از خانه شروع می‌کند و آیتم‌های قابل‌کلیک لینک می‌شوند", () => {
    render(
      <Breadcrumb
        items={[
          { name: "پوشاک", href: "/category/clothes" },
          { name: "مردانه", href: "/category/clothes/men" },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "مُداشاپ" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "پوشاک" })).toHaveAttribute("href", "/category/clothes");
    expect(screen.getByRole("link", { name: "مردانه" })).toHaveAttribute("href", "/category/clothes/men");
  });

  it("آیتم فعلی (بدون href) لینک نیست", () => {
    render(<Breadcrumb items={[{ name: "پیراهن" }]} />);
    expect(screen.queryByRole("link", { name: "پیراهن" })).not.toBeInTheDocument();
    expect(screen.getByText("پیراهن")).toBeInTheDocument();
  });

  it("هر آیتم یک جداکننده‌ی ‹ دارد", () => {
    render(<Breadcrumb items={[{ name: "پوشاک", href: "/category/clothes" }, { name: "پیراهن" }]} />);
    expect(screen.getAllByText("‹")).toHaveLength(2);
  });
});
// MobileMenu: جستجو + منوی دسته‌بندی فقط-موبایل. باید جستجو و دسته‌بندی‌ها رو
// نشون بده و با کلیک روی دکمه، منوی کشویی باز/بسته بشه.
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { useRouterMock, usePathnameMock } = vi.hoisted(() => ({
  useRouterMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => useRouterMock(),
  usePathname: () => usePathnameMock(),
}));

import { MobileMenu } from "@/components/MobileMenu";

const genderGroups = [
  {
    id: "g1",
    name: "زنانه",
    slug: "__gender-زنانه",
    icon: null,
    attrsQuery: "جنسیت~زنانه",
    children: [{ id: "c1", name: "پوشاک", slug: "clothing", icon: null, children: [] }],
  },
];

describe("MobileMenu", () => {
  beforeEach(() => {
    useRouterMock.mockReturnValue({ push: vi.fn() });
    usePathnameMock.mockReturnValue("/");
  });
  afterEach(cleanup);

  it("دکمه‌ی دسته‌بندی و جستجوی موبایل را نمایش می‌دهد", () => {
    render(<MobileMenu categories={[]} genderGroups={genderGroups} />);
    expect(screen.getByPlaceholderText("جستجوی محصول، دسته‌بندی یا برند...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /دسته‌بندی/ })).toBeInTheDocument();
    expect(screen.queryByText("زنانه")).not.toBeInTheDocument();
  });

  it("با کلیک، منوی کشویی دسته‌بندی باز و بسته می‌شود", () => {
    render(<MobileMenu categories={[]} genderGroups={genderGroups} />);
    const button = screen.getByRole("button", { name: /دسته‌بندی/ });
    fireEvent.click(button);
    expect(screen.getByText("زنانه")).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText("زنانه")).not.toBeInTheDocument();
  });

  it("لینک دسته‌بندی جنسیتی به آدرس فیلتر جنسیت می‌رود", () => {
    render(<MobileMenu categories={[]} genderGroups={genderGroups} />);
    fireEvent.click(screen.getByRole("button", { name: /دسته‌بندی/ }));
    const link = screen.getByText("زنانه").closest("a");
    expect(link).toHaveAttribute("href", "/products?attrs=%D8%AC%D9%86%D8%B3%DB%8C%D8%AA~%D8%B2%D9%86%D8%A7%D9%86%D9%87");
  });

  it("در صفحه‌ی مارکت‌پلیس (ترندیول)، درختِ زنده‌ی همون سایت را واکشی و لینک‌ها را به همون سایت می‌سازد", async () => {
    // توی مارکت‌پلیس، genderGroups (که از کاتالوگِ محلیِ مزون میاد، نه ترندیول)
    // دیگه مستقیم استفاده نمی‌شه -- باید درختِ زنده رو از همون endpointی که
    // CategoryMegaPanelِ دسکتاپ هم استفاده می‌کنه واکشی کنه، وگرنه این منو تا
    // ابد «در حال بارگذاری...» می‌موند (باگِ واقعاً گزارش‌شده)
    usePathnameMock.mockReturnValue("/marketplaces/trendyol");
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ roots: genderGroups }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MobileMenu categories={[]} genderGroups={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /دسته‌بندی/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/marketplaces/trendyol/trendyol-categories/tree");
    });
    const link = await screen.findByText("زنانه");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "/marketplaces/trendyol?attrs=%D8%AC%D9%86%D8%B3%DB%8C%D8%AA~%D8%B2%D9%86%D8%A7%D9%86%D9%87"
    );

    vi.unstubAllGlobals();
  });
});
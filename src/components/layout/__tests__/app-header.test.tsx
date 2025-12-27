import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { AppHeader } from "../app-header";

// Mock next-intl navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/calendar",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock useSession from better-auth
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: { name: "Test User", email: "test@example.com", image: null },
    },
    isPending: false,
  }),
}));

// Mock useIsManager hook
vi.mock("@/hooks/use-is-manager", () => ({
  useIsManager: vi.fn(() => true),
}));

const messages = {
  Header: {
    brand: "Kynite",
    tagline: "Routines without the friction",
  },
  Menu: {
    dashboard: "Dashboard",
    calendar: "Calendar",
    chores: "Chores",
    settings: "Settings",
    help: "Help",
  },
};

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <AppHeader />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows avatar when user is manager", async () => {
    const { useIsManager } = await import("@/hooks/use-is-manager");
    vi.mocked(useIsManager).mockReturnValue(true);

    renderWithProviders();
    expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
  });

  it("hides avatar when user is not manager", async () => {
    const { useIsManager } = await import("@/hooks/use-is-manager");
    vi.mocked(useIsManager).mockReturnValue(false);

    renderWithProviders();
    expect(screen.queryByTestId("user-avatar")).not.toBeInTheDocument();
  });

  it("renders brand area", () => {
    renderWithProviders();
    expect(screen.getByText("Kynite")).toBeInTheDocument();
  });

  it("renders menu button", () => {
    renderWithProviders();
    expect(
      screen.getByRole("button", { name: /open menu/i })
    ).toBeInTheDocument();
  });
});

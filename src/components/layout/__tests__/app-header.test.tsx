import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { AppHeader } from "../app-header";
import { InteractionModeProvider } from "@/contexts/interaction-mode-context";

// Mock next-intl navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/calendar",
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

function renderWithProviders(mode: "wall" | "manage" = "manage") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <InteractionModeProvider initialMode={mode}>
        <AppHeader />
      </InteractionModeProvider>
    </NextIntlClientProvider>
  );
}

describe("AppHeader", () => {
  it("shows avatar in manage mode", () => {
    renderWithProviders("manage");
    expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
  });

  it("hides avatar in wall mode", () => {
    renderWithProviders("wall");
    expect(screen.queryByTestId("user-avatar")).not.toBeInTheDocument();
  });

  it("renders brand area", () => {
    renderWithProviders("manage");
    expect(screen.getByText("Kynite")).toBeInTheDocument();
  });

  it("renders menu button", () => {
    renderWithProviders("manage");
    expect(
      screen.getByRole("button", { name: /open menu/i })
    ).toBeInTheDocument();
  });
});

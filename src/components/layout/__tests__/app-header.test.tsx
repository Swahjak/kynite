import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    brand: "Family Planner",
    tagline: "FAMILY OS",
    addEvent: "Add Event",
  },
  Menu: {
    dashboard: "Dashboard",
    calendar: "Calendar",
    chores: "Chores",
    settings: "Settings",
    help: "Help",
  },
};

function renderWithProviders(
  mode: "wall" | "manage" = "manage",
  props: { onAddEvent?: () => void } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <InteractionModeProvider initialMode={mode}>
        <AppHeader {...props} />
      </InteractionModeProvider>
    </NextIntlClientProvider>
  );
}

describe("AppHeader", () => {
  it("shows add event button in manage mode", () => {
    renderWithProviders("manage", { onAddEvent: vi.fn() });
    const addButtons = screen.getAllByRole("button", { name: /add event/i });
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it("hides add event button in wall mode", () => {
    renderWithProviders("wall", { onAddEvent: vi.fn() });
    expect(
      screen.queryByRole("button", { name: /add event/i })
    ).not.toBeInTheDocument();
  });

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
    expect(screen.getByText("Family Planner")).toBeInTheDocument();
  });
});

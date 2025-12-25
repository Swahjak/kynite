import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { NavigationMenu } from "../navigation-menu";

// Mock next-intl navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/calendar",
}));

// Mock ProgressLink to avoid needing NavigationProgressProvider
vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock useIsManager hook
vi.mock("@/hooks/use-is-manager", () => ({
  useIsManager: vi.fn(() => true),
}));

const messages = {
  Header: { brand: "Kynite", tagline: "Routines without the friction" },
  Menu: {
    dashboard: "Dashboard",
    calendar: "Calendar",
    chores: "Chores",
    rewardChart: "Star Chart",
    rewards: "Rewards",
    settings: "Settings",
    help: "Help",
  },
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("NavigationMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all items when user is manager", async () => {
    const { useIsManager } = await import("@/hooks/use-is-manager");
    vi.mocked(useIsManager).mockReturnValue(true);

    renderWithProviders(<NavigationMenu open={true} onOpenChange={() => {}} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Chores")).toBeInTheDocument();
    expect(screen.getByText("Star Chart")).toBeInTheDocument();
    expect(screen.getByText("Rewards")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("hides chores and settings when user is not manager", async () => {
    const { useIsManager } = await import("@/hooks/use-is-manager");
    vi.mocked(useIsManager).mockReturnValue(false);

    renderWithProviders(<NavigationMenu open={true} onOpenChange={() => {}} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.queryByText("Chores")).not.toBeInTheDocument();
    expect(screen.getByText("Star Chart")).toBeInTheDocument();
    expect(screen.getByText("Rewards")).toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { NavigationMenu } from "../navigation-menu";
import {
  InteractionModeProvider,
  type InteractionMode,
} from "@/contexts/interaction-mode-context";

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

function renderWithProviders(
  ui: React.ReactElement,
  mode: InteractionMode = "manage"
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <InteractionModeProvider initialMode={mode}>{ui}</InteractionModeProvider>
    </NextIntlClientProvider>
  );
}

describe("NavigationMenu", () => {
  it("renders all items in manage mode", () => {
    renderWithProviders(<NavigationMenu open={true} onOpenChange={() => {}} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Chores")).toBeInTheDocument();
    expect(screen.getByText("Star Chart")).toBeInTheDocument();
    expect(screen.getByText("Rewards")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("hides chores and settings in wall mode", () => {
    renderWithProviders(
      <NavigationMenu open={true} onOpenChange={() => {}} />,
      "wall"
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.queryByText("Chores")).not.toBeInTheDocument();
    expect(screen.getByText("Star Chart")).toBeInTheDocument();
    expect(screen.getByText("Rewards")).toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });
});

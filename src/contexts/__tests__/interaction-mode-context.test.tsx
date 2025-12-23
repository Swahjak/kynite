import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  InteractionModeProvider,
  useInteractionMode,
} from "../interaction-mode-context";

function TestComponent() {
  const { mode } = useInteractionMode();
  return <div data-testid="mode">{mode}</div>;
}

describe("InteractionModeContext", () => {
  it("provides wall mode when specified", () => {
    render(
      <InteractionModeProvider initialMode="wall">
        <TestComponent />
      </InteractionModeProvider>
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("wall");
  });

  it("provides manage mode when specified", () => {
    render(
      <InteractionModeProvider initialMode="manage">
        <TestComponent />
      </InteractionModeProvider>
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("manage");
  });

  it("throws error when used outside provider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow(
      "useInteractionMode must be used within InteractionModeProvider"
    );

    consoleSpy.mockRestore();
  });
});

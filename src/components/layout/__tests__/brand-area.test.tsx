import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { BrandArea } from "../brand-area";

const messages = {
  Header: {
    brand: "Family Planner",
    tagline: "FAMILY OS",
  },
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("BrandArea", () => {
  it("renders brand name and tagline", () => {
    renderWithProviders(<BrandArea />);

    expect(screen.getByText("Family Planner")).toBeInTheDocument();
    expect(screen.getByText("FAMILY OS")).toBeInTheDocument();
  });

  it("renders home icon in circular container", () => {
    renderWithProviders(<BrandArea />);

    const icon = screen.getByTestId("brand-icon");
    expect(icon).toBeInTheDocument();
  });
});

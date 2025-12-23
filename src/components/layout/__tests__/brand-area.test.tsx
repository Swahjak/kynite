import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { BrandArea } from "../brand-area";

const messages = {
  Header: {
    brand: "Kynite",
    tagline: "Routines without the friction",
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

    expect(screen.getByText("Kynite")).toBeInTheDocument();
    expect(
      screen.getByText("Routines without the friction")
    ).toBeInTheDocument();
  });

  it("renders logo icon", () => {
    renderWithProviders(<BrandArea />);

    const icon = screen.getByTestId("brand-icon");
    expect(icon).toBeInTheDocument();
  });
});

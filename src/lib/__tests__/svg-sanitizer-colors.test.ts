import { describe, it, expect } from "vitest";
import { sanitizeSvg } from "../svg-sanitizer";

describe("sanitizeSvg color preservation", () => {
  it("preserves inline style elements", () => {
    const svg =
      '<svg><style>.skin{fill:#D0C6AC}</style><circle class="skin"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain("<style");
    expect(result).toContain("fill:#D0C6AC");
  });

  it("preserves defs and gradients", () => {
    const svg =
      '<svg><defs><linearGradient id="g1"><stop stop-color="#ff0000"/></linearGradient></defs><rect fill="url(#g1)"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain("<defs");
    expect(result).toContain("linearGradient");
  });

  it("preserves fill and stroke attributes", () => {
    const svg = '<svg><circle fill="#ff0000" stroke="#0000ff"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain('fill="#ff0000"');
    expect(result).toContain('stroke="#0000ff"');
  });

  it("preserves clipPath elements", () => {
    const svg =
      '<svg><defs><clipPath id="clip1"><circle cx="50" cy="50" r="40"/></clipPath></defs><rect clip-path="url(#clip1)"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain("clipPath");
    expect(result).toContain('clip-path="url(#clip1)"');
  });
});

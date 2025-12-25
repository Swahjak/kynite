import { describe, it, expect } from "vitest";
import { sanitizeSvg, isValidSvg } from "../svg-sanitizer";

describe("sanitizeSvg", () => {
  it("preserves valid avataaars SVG structure", () => {
    const validSvg = `<svg viewBox="0 0 264 280" xmlns="http://www.w3.org/2000/svg">
      <circle cx="132" cy="140" r="100" fill="#D0C6AC"/>
    </svg>`;
    const result = sanitizeSvg(validSvg);
    expect(result).toContain("<svg");
    expect(result).toContain("<circle");
  });

  it("strips script tags", () => {
    const maliciousSvg = `<svg><script>alert('xss')</script><circle/></svg>`;
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
  });

  it("strips event handlers", () => {
    const maliciousSvg = `<svg><circle onclick="alert('xss')" onerror="alert('xss')"/></svg>`;
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onerror");
  });

  it("strips javascript URLs", () => {
    const maliciousSvg = `<svg><a href="javascript:alert('xss')"><circle/></a></svg>`;
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain("javascript:");
  });
});

describe("isValidSvg", () => {
  it("returns true for valid SVG", () => {
    const validSvg = `<svg viewBox="0 0 100 100"><circle/></svg>`;
    expect(isValidSvg(validSvg)).toBe(true);
  });

  it("returns false for non-SVG content", () => {
    expect(isValidSvg("<div>not svg</div>")).toBe(false);
    expect(isValidSvg("plain text")).toBe(false);
    expect(isValidSvg("")).toBe(false);
  });
});

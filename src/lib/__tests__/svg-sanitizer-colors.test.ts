import { describe, it, expect } from "vitest";
import { sanitizeSvg } from "../svg-sanitizer";
import { readFileSync } from "fs";
import { join } from "path";

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

  it("preserves <use> elements with xlink:href", () => {
    const svg =
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="myPath" d="M10,10"/></defs><use xlink:href="#myPath" fill="#ff0000"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain("<use");
    expect(result).toContain('xlink:href="#myPath"');
  });

  it("preserves <use> inside <mask> elements", () => {
    const svg =
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="maskPath" d="M10,10"/></defs><mask id="myMask" fill="white"><use xlink:href="#maskPath"></use></mask></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain("<mask");
    expect(result).toContain("<use");
    expect(result).toContain('xlink:href="#maskPath"');
  });

  it("preserves mask attribute references", () => {
    const svg =
      '<svg><defs><mask id="mask1"><rect fill="white"/></mask></defs><g mask="url(#mask1)"><circle/></g></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain('mask="url(#mask1)"');
  });

  describe("avataaars.com SVG compatibility", () => {
    // Test with actual avataaars.svg structure
    const avataaarsTestSvg = `<svg width="264px" height="280px" viewBox="0 0 264 280" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <desc>Created with getavataaars.com</desc>
      <defs>
        <circle id="react-path-1" cx="120" cy="120" r="120"></circle>
        <path d="M124,144 L124,163" id="react-path-3"></path>
      </defs>
      <g id="Avataaar" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g id="Body" transform="translate(32.000000, 36.000000)">
          <mask id="react-mask-6" fill="white">
            <use xlink:href="#react-path-3"></use>
          </mask>
          <use fill="#D0C6AC" xlink:href="#react-path-3"></use>
          <g id="Skin" mask="url(#react-mask-6)" fill="#EDB98A">
            <rect x="0" y="0" width="264" height="280"></rect>
          </g>
        </g>
      </g>
    </svg>`;

    it("preserves <desc> element", () => {
      const result = sanitizeSvg(avataaarsTestSvg);
      expect(result).toContain("<desc>");
      expect(result).toContain("getavataaars.com");
    });

    it("preserves <defs> with paths and circles", () => {
      const result = sanitizeSvg(avataaarsTestSvg);
      expect(result).toContain("<defs>");
      expect(result).toContain('id="react-path-1"');
      expect(result).toContain('id="react-path-3"');
    });

    it("preserves <use> elements referencing defs", () => {
      const result = sanitizeSvg(avataaarsTestSvg);
      expect(result).toContain("<use");
      expect(result).toContain('xlink:href="#react-path-3"');
    });

    it("preserves <use> inside <mask>", () => {
      const result = sanitizeSvg(avataaarsTestSvg);
      expect(result).toContain("<mask");
      expect(result).toContain('id="react-mask-6"');
      // The use element inside mask should be preserved
      expect(result).toMatch(
        /<mask[^>]*>[\s\S]*<use[^>]*xlink:href="#react-path-3"/
      );
    });

    it("preserves mask attribute on elements", () => {
      const result = sanitizeSvg(avataaarsTestSvg);
      expect(result).toContain('mask="url(#react-mask-6)"');
    });

    it("preserves fill colors", () => {
      const result = sanitizeSvg(avataaarsTestSvg);
      expect(result).toContain('fill="#D0C6AC"');
      expect(result).toContain('fill="#EDB98A"');
    });

    it("preserves transform attributes", () => {
      const result = sanitizeSvg(avataaarsTestSvg);
      expect(result).toContain('transform="translate(32.000000, 36.000000)"');
    });
  });

  describe("real avataaars.svg file", () => {
    it("preserves all critical elements from actual file", () => {
      const originalSvg = readFileSync(
        join(__dirname, "fixtures/avataaars.svg"),
        "utf-8"
      );
      const result = sanitizeSvg(originalSvg);

      // Key structural elements
      expect(result).toContain("<defs>");
      expect(result).toContain("<mask");
      expect(result).toContain("<use");

      // xlink:href references must be preserved
      expect(result).toContain('xlink:href="#react-path-3"');

      // Skin colors must be preserved
      expect(result).toContain('fill="#D0C6AC"'); // Base skin color
      expect(result).toContain('fill="#EDB98A"'); // Skin overlay

      // Hair color
      expect(result).toContain('fill="#D6B370"');

      // Mask references must be preserved
      expect(result).toContain('mask="url(#react-mask-6)"');

      // Use elements should exist (body uses paths from defs)
      const useCount = (result.match(/<use/g) || []).length;
      expect(useCount).toBeGreaterThan(0);

      console.log("Original length:", originalSvg.length);
      console.log("Sanitized length:", result.length);
      console.log("Use elements found:", useCount);
    });
  });
});

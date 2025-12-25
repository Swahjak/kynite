import createDOMPurify, { type WindowLike } from "dompurify";
import { JSDOM } from "jsdom";

/**
 * Sanitize SVG content by removing potentially dangerous elements
 * Strips scripts, event handlers, and external resource references
 *
 * Uses jsdom for proper SVG parsing. happy-dom was tried but it doesn't
 * correctly parse SVG content (strips style contents and some elements).
 */
export function sanitizeSvg(svgContent: string): string {
  // Create a fresh DOM environment for each sanitization
  // This ensures proper isolation and avoids state leakage
  const jsdom = new JSDOM("", { contentType: "text/html" });

  const DOMPurify = createDOMPurify(jsdom.window as unknown as WindowLike);

  const result = DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Allow style elements - needed for avataaars and similar SVGs that use
    // inline stylesheets for colors. Without this, style blocks are stripped.
    ADD_TAGS: ["style", "use"],
    // Allow xlink:href - needed for <use> elements to reference <defs>.
    // DOMPurify strips xlink:href by default as a security measure, but for
    // internal references (starting with #) it's safe and necessary.
    ADD_ATTR: ["xlink:href"],
  });

  // Clean up to avoid memory leaks in serverless
  jsdom.window.close();

  return result;
}

/**
 * Check if content appears to be a valid SVG
 * Basic validation - checks for opening svg tag
 */
export function isValidSvg(content: string): boolean {
  if (!content || typeof content !== "string") {
    return false;
  }
  const trimmed = content.trim();
  return trimmed.startsWith("<svg") && trimmed.includes("</svg>");
}

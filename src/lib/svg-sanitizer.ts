import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize SVG content by removing potentially dangerous elements
 * Strips scripts, event handlers, and external resource references
 */
export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
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

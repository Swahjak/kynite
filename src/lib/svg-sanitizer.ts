import createDOMPurify from "dompurify";
import { Window } from "happy-dom";

/**
 * Sanitize SVG content by removing potentially dangerous elements
 * Strips scripts, event handlers, and external resource references
 *
 * Uses happy-dom instead of jsdom to avoid ESM/CJS compatibility issues
 * in serverless environments (Vercel Edge, etc.)
 */
export function sanitizeSvg(svgContent: string): string {
  // Create a fresh DOM environment for each sanitization
  // This ensures proper isolation and avoids state leakage
  const window = new Window();

  const DOMPurify = createDOMPurify(window as any);

  const result = DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });

  // Clean up to avoid memory leaks in serverless
  window.close();

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

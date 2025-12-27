import { useMDXComponents as getNextraMDXComponents } from "nextra-theme-docs";
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...getNextraMDXComponents(),
    ...components,
  };
}

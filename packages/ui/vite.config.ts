import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * Vite config for Storybook (`@storybook/react-vite` merges this in).
 *
 * The only thing it has to add is Tailwind: the app compiles the design
 * system's CSS through `@tailwindcss/postcss` under Next, and this is the same
 * Tailwind 4, same major, same token file — just driven by the Vite plugin.
 */
export default defineConfig({
  plugins: [tailwindcss()],
});

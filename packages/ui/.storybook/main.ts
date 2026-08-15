import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  /**
   * Stories live in `stories/`, not beside the components in `src/`.
   *
   * That is a Tailwind decision, not a taste one: the app compiles this
   * package with `@source '…/packages/ui/src'`, so anything under `src/` puts
   * its class strings into the *product's* stylesheet. A specimen grid's
   * one-off `grid-cols-[repeat(4,72px)]` has no business shipping to a phone.
   */
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],

  /**
   * `@storybook/addon-mcp` publishes an MCP server at `/mcp` on the dev
   * server, so an agent with the repo's `.mcp.json` gets Storybook's own
   * component/story tools while `pnpm storybook` is running. See CLAUDE.md
   * § "Storybook MCP".
   */
  addons: ['@storybook/addon-mcp'],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  /**
   * Two static roots.
   *
   * `./static` is the package's own: the brand marks the Foundations stories
   * render, and the four avataaars fixtures.
   *
   * `/fonts` is the *app's* font directory, and is the one place Storybook
   * reaches outside the package. The Material Symbols subset is a build
   * artefact — `apps/web/scripts/subset-icons.mjs` regenerates it from the
   * `<Icon name="…">` call sites and holds it to a 64 KB budget — so pointing
   * at the generated file is what keeps stories showing the glyphs the app
   * actually ships. Copying it here would be a second copy that silently goes
   * stale the next time the subset is rebuilt.
   *
   * The brand fonts need no such trick: `@fontsource*` self-hosts Baloo 2 and
   * Poppins from node_modules, matching what `next/font` does for the app.
   * Nothing here loads anything from a Google CDN at runtime.
   */
  staticDirs: ['./static', { from: '../../../apps/web/src/styles/fonts', to: '/fonts' }],
};

export default config;

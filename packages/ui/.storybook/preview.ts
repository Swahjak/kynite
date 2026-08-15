import type { Preview } from '@storybook/react-vite';

import './preview.css';

/**
 * The two backgrounds are the design system's own two grounds — the cream app
 * surface (`--background`) and the dark surface it uses for the reversed
 * lockup, the toast and the inverse card. `.dark` on the story root is what
 * switches the token palette, so the dark option sets both.
 */
const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        cream: { name: 'Surface (cream)', value: '#fbf9f4' },
        white: { name: 'Surface Lowest', value: '#ffffff' },
        dark: { name: 'On Surface (dark)', value: '#191c1d' },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: 'cream' },
  },
};

export default preview;

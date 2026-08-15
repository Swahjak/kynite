'use client';

import { ChimeSettings } from './chime-settings';
import { useChime } from './use-chime';

/**
 * `ChimeSettings` with its own `useChime()` — the shape another surface can
 * mount without holding the hook itself.
 *
 * It exists because of a boundary, and the boundary is the right one. The kiosk
 * shell (`components/hub`) hosts the chime control in its settings corner
 * (M12), but the shell is a *client* component, and a client component may not
 * import `@/modules/timers`: the slice barrel re-exports `queries.ts`, which is
 * `server-only` and drags `pg` into the browser bundle. Deep-importing
 * `…/ui/chime-settings` instead is banned by the module-boundary rule, and
 * rightly — that is the escape hatch the rule exists to close.
 *
 * So the slice exports a component that needs nothing passed to it, the hub
 * *layout* (a server component, which may import the barrel) renders it, and it
 * arrives at the shell as a plain React node. The setting itself is a
 * localStorage-backed external store, so this instance and the board's agree
 * without either knowing the other exists.
 */
export function ChimeSettingsPanel() {
  return <ChimeSettings chime={useChime()} />;
}

/**
 * Public surface of the surface slice (H2a, docs/plans/2026-09-15-hub-equals-app.md).
 * Cross-module imports go through this file only.
 */
export {
  resolveSurface,
  presentationFor,
  SURFACE_COOKIE,
  type Surface,
  type SurfaceCookieValue,
  type Presentation,
  type ResolveSurfaceInput,
} from './resolve';
export { getSurface } from './server';
export { getSurfacePreference, type SurfacePreference } from './queries';
export { setSurfacePreferenceAction } from './actions';
export { idleState, type ActionState } from './action-state';
export {
  SurfacePreferenceForm,
  type SurfacePreferenceFormProps,
} from './ui/surface-preference-form';

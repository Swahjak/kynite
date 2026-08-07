/**
 * Public surface of the devices slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * Note what is *not* here: the request-side resolution of the kiosk cookie into
 * a principal. That lives in `modules/family/principal.ts` alongside the
 * account-session resolution, because the two are one decision ("who is
 * asking") and because importing this barrel from there would close an import
 * cycle — `actions.ts` below needs `assertCan` from the family slice. The
 * primitives both sides share are in `@/lib/device-session`, which is pure.
 */

export {
  DEVICE_KINDS,
  device,
  deviceKind,
  devicePairingAttempt,
  devicePairingCode,
  deviceSession,
  type Device,
  type DeviceKind,
  type DevicePairingCode,
  type DeviceSession,
} from './schema';

export {
  cancelPairingCode,
  countRecentGlobalPairingFailures,
  countRecentPairingFailures,
  createPairingCode,
  getDevice,
  listDevices,
  listPendingPairingCodes,
  redeemPairingCode,
  revokeDevice,
  trimDeviceSessions,
  type CreatePairingCodeResult,
  type DeviceListEntry,
  type DeviceTrimResult,
  type PairingFailure,
  type PairingSuccess,
  type PendingPairingCode,
} from './queries';

export {
  actionFailure,
  idleState,
  pairDeviceIdle,
  pairingCodeIdle,
  type ActionState,
  type PairDeviceState,
  type PairingCodeState,
} from './action-state';

export {
  cancelPairingCodeAction,
  createPairingCodeAction,
  pairDeviceAction,
  revokeDeviceAction,
  type CancelPairingCodeInput,
  type CreatePairingCodeInput,
  type PairDeviceInput,
  type RevokeDeviceInput,
} from './actions';

export { loadDevicesPage, type DevicesPageData } from './page-data';

export { requireHubDevice } from './hub-gate';

export { DeviceList } from './ui/device-list';
export { PairCodeForm } from './ui/pair-code-form';
export { PairDevicePanel } from './ui/pair-device-panel';
export { PendingCodeList } from './ui/pending-code-list';

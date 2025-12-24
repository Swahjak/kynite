import { z } from "zod";

// =============================================================================
// PAIRING SCHEMAS
// =============================================================================

export const generatePairingCodeSchema = z.object({
  deviceName: z.string().min(1).max(50),
});

export const completePairingSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

export type GeneratePairingCodeInput = z.infer<
  typeof generatePairingCodeSchema
>;
export type CompletePairingInput = z.infer<typeof completePairingSchema>;

// =============================================================================
// DEVICE MANAGEMENT SCHEMAS
// =============================================================================

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(50),
});

export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

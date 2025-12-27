/**
 * Represents a linked Google account
 */
export interface LinkedGoogleAccount {
  id: string;
  googleAccountId: string;
  email?: string;
  scopes: string[];
  linkedAt: Date;
  lastSyncError?: string | null;
  lastSyncErrorAt?: string | null; // ISO string for JSON serialization
}

/**
 * API response for linked accounts list
 */
export interface LinkedAccountsResponse {
  success: boolean;
  data?: {
    accounts: LinkedGoogleAccount[];
    count: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * API response for account operations (unlink, etc.)
 */
export interface AccountOperationResponse {
  success: boolean;
  data?: {
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

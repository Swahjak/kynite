/**
 * Public surface of the OAuth/MCP consent slice (M-C). Cross-module imports
 * go through this file only — same convention as every other slice
 * (docs/architecture.md §2).
 */

export { oauthConsentAction } from './actions';
export {
  KNOWN_OAUTH_SCOPES,
  loadOAuthConsentPage,
  type OAuthConsentClient,
  type OAuthConsentPageData,
} from './page-data';
export { OAuthConsentForm } from './ui/oauth-consent-form';

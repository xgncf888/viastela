/** Edge Function copy. Keep this behavior identical to the app module and do not import application source. */

/**
 * Browser origins allowed to call `delete-account`.
 *
 * Exact origins come from the `DELETE_ACCOUNT_ALLOWED_ORIGINS` function env var,
 * which `index.ts` is the only file that reads. The hosted value is the
 * production origin below. Local dev may add the localhost origins in a
 * gitignored functions env file. Those localhost origins are not a production default.
 *
 * Branch previews are not listed in the env var. Only this anchored pattern
 * matches, so other `*.vercel.app` hosts, suffix tricks, http, and ports do not.
 * Per-commit hash URLs (`https://viastela-<hash>-xgncf888.vercel.app`) have no
 * `-git-` segment and do not match.
 */

export const deleteAccountAllowedOriginsEnv = 'DELETE_ACCOUNT_ALLOWED_ORIGINS';

export const deleteAccountProductionOrigin = 'https://viastela.vercel.app';

export const deleteAccountLocalOrigins = ['http://localhost:8081', 'http://localhost:19006'] as const;

export const deleteAccountPreviewOrigin =
  /^https:\/\/viastela-git-[a-z0-9-]+-xgncf888\.vercel\.app$/;

export const deleteAccountPreviewExample =
  'https://viastela-git-cursor-training-sets-soft-delete-193f-xgncf888.vercel.app';

export function parseAllowedOrigins(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  for (const part of value.split(',')) {
    const origin = part.trim();
    if (!isExactOrigin(origin) || seen.has(origin)) continue;
    seen.add(origin);
  }
  return [...seen];
}

/**
 * True only for an exact allowlisted origin or a branch preview.
 * The literal `null`, `*`, and any other unlisted origin are false.
 * This never treats `*` as a wildcard.
 */
export function isAllowedDeleteOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  if (!isExactOrigin(origin)) return false;
  if (deleteAccountPreviewOrigin.test(origin)) return true;
  return allowedOrigins.some((allowed) => allowed === origin);
}

function isExactOrigin(value: string): boolean {
  if (value === '*' || value === 'null') return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === value;
}

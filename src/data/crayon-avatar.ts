import { localStore } from './local-store';

/** Portrait ids only. The treasure chest is not selectable. */
export const CRAYON_AVATAR_IDS = [
  '01-inventor-boy',
  '03-tiny-knight',
  '06-librarian-boy',
  '10-cyclist-boy',
  '11-cat-ear-yellow',
  '16-coder-boy',
  '17-explorer-girl',
] as const;

export type CrayonPortraitId = (typeof CRAYON_AVATAR_IDS)[number];

export const DEFAULT_CRAYON_AVATAR: CrayonPortraitId = '11-cat-ear-yellow';

export const CRAYON_AVATAR_STORAGE_KEY = 'viastela.crayon-avatar.v1';

const PORTRAIT_IDS: readonly string[] = CRAYON_AVATAR_IDS;

export function isCrayonPortraitId(value: string | null | undefined): value is CrayonPortraitId {
  return typeof value === 'string' && PORTRAIT_IDS.includes(value);
}

/** Local-only portrait choice. Nothing is written to Supabase. */
export async function readCrayonAvatar(): Promise<CrayonPortraitId> {
  const stored = await (await localStore()).getItem(CRAYON_AVATAR_STORAGE_KEY);
  return isCrayonPortraitId(stored) ? stored : DEFAULT_CRAYON_AVATAR;
}

export async function writeCrayonAvatar(id: CrayonPortraitId): Promise<void> {
  if (!isCrayonPortraitId(id)) throw new Error('unknown avatar');
  await (await localStore()).setItem(CRAYON_AVATAR_STORAGE_KEY, id);
}

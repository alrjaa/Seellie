/**
 * Cheap local media-URL gate for General feed (no HEAD/fetch).
 * Rejects empty, non-http(s), and known placeholder/non-media hosts.
 */
const PLACEHOLDER_HOSTS = new Set([
  'placehold.co',
  'placehold.it',
  'placeholder.com',
  'via.placeholder.com',
  'dummyimage.com',
  'fakeimg.pl',
  'placekitten.com',
  'lorempixel.com',
]);

/** Not a media resource — organic feed must not treat this as playable content. */
const NON_MEDIA_HOSTS = new Set(['xxxxx.com']);

function hostMatches(host: string, listed: Set<string>): boolean {
  for (const item of listed) {
    if (host === item || host.endsWith(`.${item}`)) return true;
  }
  return false;
}

export function isPlayableMediaUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (hostMatches(host, PLACEHOLDER_HOSTS)) return false;
  if (hostMatches(host, NON_MEDIA_HOSTS)) return false;
  return true;
}

export function playableMediaUrl(value: unknown): string | undefined {
  if (!isPlayableMediaUrl(value)) return undefined;
  return String(value).trim();
}

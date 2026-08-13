/**
 * FIX-05 — shared cloud fetch apply gate (pure, no RN/Supabase).
 * Only SUCCESS (`ok === true`) may update local catalogs.
 * ERROR / missing ok → keep local (ERROR ≠ EMPTY).
 */
export function shouldApplyCloudResult(res: {
  ok?: boolean;
  error?: string;
}): boolean {
  return res.ok === true;
}

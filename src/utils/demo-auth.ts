/**
 * P0 (FIX-02/03/04): local/demo auth is DEV-only unless explicitly opted in.
 * Published web/native builds must use Supabase Auth only.
 */
export function allowLocalDemoAuth(): boolean {
  const flag = (
    process.env.EXPO_PUBLIC_ALLOW_DEMO_AUTH || ''
  ).trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

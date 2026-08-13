/** Pure helper — strip accessCode from analyst objects (FIX-01). No RN/Supabase imports. */
export function stripAnalystAccessCode<T extends { accessCode?: string } | null | undefined>(
  analyst: T
): T {
  if (!analyst || typeof analyst !== 'object') return analyst;
  if (!('accessCode' in analyst)) return analyst;
  const { accessCode: _removed, ...rest } = analyst as {
    accessCode?: string;
  } & Record<string, unknown>;
  return rest as T;
}

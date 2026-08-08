/** Case-insensitive substring search across one or more text fields. */
export function matchesSearchQuery(
  query: string,
  ...parts: Array<string | number | null | undefined>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = parts
    .filter((p) => p != null && String(p).length > 0)
    .map((p) => String(p).toLowerCase())
    .join(' ');
  if (haystack.includes(q)) return true;
  return q.split(/\s+/).every((part) => haystack.includes(part));
}

/** تطبيع اسم الحكم لمنع التكرار (مسافات زائدة / تطويل / حالة الأحرف) */
export function normalizeRefereeName(name: string): string {
  return name
    .trim()
    .replace(/\u0640/g, '') // ـ
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ar');
}

export function findRefereeByName(
  referees: { id: string; name: string }[],
  name: string
): { id: string; name: string } | undefined {
  const key = normalizeRefereeName(name);
  if (!key) return undefined;
  return referees.find((r) => normalizeRefereeName(r.name) === key);
}

/** يُبقي حكماً واحداً لكل اسم مطبّع: يفضّل من لديه صورة ثم النشط ثم الأقدم */
export function pickRefereeDedupWinner<
  T extends { id: string; name: string; avatar?: string; status?: string },
>(group: T[]): T {
  return [...group].sort((a, b) => {
    const av = (b.avatar ? 1 : 0) - (a.avatar ? 1 : 0);
    if (av !== 0) return av;
    const activeA = a.status === 'active' ? 1 : 0;
    const activeB = b.status === 'active' ? 1 : 0;
    if (activeB !== activeA) return activeB - activeA;
    return a.id.localeCompare(b.id);
  })[0];
}

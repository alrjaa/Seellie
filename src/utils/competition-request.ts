/** الحد الأدنى لعدد الفرق في أي مسابقة */
export const MIN_COMPETITION_TEAMS = 6;

/** شروط تنظيم مسابقة عبر التطبيق */
export const COMPETITION_ORG_TERMS = [
  'أوافق على شروط استخدام تطبيق Seellie لتنظيم المسابقات الرياضية.',
  'أتعهد ببذل العناية اللازمة في إدارة المسابقة والالتزام باللوائح المعتمدة.',
  'أتعهد ألا تقل المسابقة عن ستة فرق مشاركة.',
  'أتعهد بتجهيز الملعب أو الملاعب بكل المتطلبات الرئيسية (أرضية صالحة، أهداف، خطوط، إضاءة عند الحاجة، مرافق أساسية للسلامة).',
  'أتعهد بالقيام بإجراءات الإسعافات الأولية لأي مصاب في المسابقة وتوفير الاستجابة المناسبة للطوارئ.',
  'أتعهد بعدم إثارة اضطرابات بين الفرق أو المشجعين، والحفاظ على النظام والسلوك الرياضي طوال المسابقة.',
  'ألتزم بتحديد منطقة المسابقة والمدينة والحي بدقة، وأتحمّل مسؤولية صحة البيانات.',
  'أفهم أن الطلب يخضع لمراجعة المشرف، وله الحق في القبول أو الرفض.',
].join('\n\n');

export function nextCompetitionVisibleId(
  competitions: Array<{ visibleId?: string }>
): string {
  let max = 1000;
  competitions.forEach((c) => {
    const m = c.visibleId?.match(/^C(\d+)$/i);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  });
  return `C${max + 1}`;
}

export function buildCompetitionVenueAddress(input: {
  venueName: string;
  neighborhood: string;
  city: string;
  region: string;
  country?: string;
}): string {
  return [
    input.venueName,
    input.neighborhood,
    input.city,
    input.region,
    input.country,
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('، ');
}

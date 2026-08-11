/** كتالوج الدوريات المدعومة — قابل للتوسعة */

export type TrackedLeague = {
  leagueId: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  countryAr: string;
};

export const TRACKED_LEAGUES: TrackedLeague[] = [
  {
    leagueId: 307,
    slug: 'saudi-pro-league',
    nameAr: 'الدوري السعودي',
    nameEn: 'Saudi Pro League',
    countryAr: 'السعودية',
  },
  {
    leagueId: 39,
    slug: 'premier-league',
    nameAr: 'الدوري الإنجليزي',
    nameEn: 'Premier League',
    countryAr: 'إنجلترا',
  },
  {
    leagueId: 140,
    slug: 'la-liga',
    nameAr: 'الدوري الإسباني',
    nameEn: 'La Liga',
    countryAr: 'إسبانيا',
  },
  {
    leagueId: 135,
    slug: 'serie-a',
    nameAr: 'الدوري الإيطالي',
    nameEn: 'Serie A',
    countryAr: 'إيطاليا',
  },
  {
    leagueId: 78,
    slug: 'bundesliga',
    nameAr: 'الدوري الألماني',
    nameEn: 'Bundesliga',
    countryAr: 'ألمانيا',
  },
  {
    leagueId: 61,
    slug: 'ligue-1',
    nameAr: 'الدوري الفرنسي',
    nameEn: 'Ligue 1',
    countryAr: 'فرنسا',
  },
];

export function findTrackedLeague(leagueId: number): TrackedLeague | undefined {
  return TRACKED_LEAGUES.find((l) => l.leagueId === leagueId);
}

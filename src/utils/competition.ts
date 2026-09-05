import type { Competition, Match, Team } from '@/data/initial-data';
import { createId } from '@/utils/id';
import { i18n, t } from '@/i18n';
import { localizeContentText } from '@/i18n/localize-content';

export type StandingRow = {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

/** Round-robin fixture generator (single round). */
export function buildRoundRobinFixtures(
  competitionId: string,
  teams: Team[],
  startDate = new Date()
): Match[] {
  if (teams.length < 2) return [];

  const matches: Match[] = [];
  let dayOffset = 0;

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(18, 0, 0, 0);
      matches.push({
        id: createId(),
        competitionId,
        team1Id: teams[i].id,
        team2Id: teams[j].id,
        team1Score: 0,
        team2Score: 0,
        date,
        media: { photos: [], videos: [] },
        comments: [],
        analysisContent: [],
      });
      dayOffset += 1;
    }
  }

  return matches;
}

export function computeStandings(competition: Competition): StandingRow[] {
  const table = new Map<string, StandingRow>();

  competition.teams.forEach((team) => {
    table.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      teamLogo: team.logo,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  });

  const now = Date.now();
  competition.matches.forEach((match) => {
    // Count only played matches (past or with scores already set beyond pristine future)
    const isPlayed =
      new Date(match.date).getTime() <= now ||
      match.team1Score > 0 ||
      match.team2Score > 0;

    if (!isPlayed) return;

    const home = table.get(match.team1Id);
    const away = table.get(match.team2Id);
    if (!home || !away) return;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.team1Score;
    home.goalsAgainst += match.team2Score;
    away.goalsFor += match.team2Score;
    away.goalsAgainst += match.team1Score;

    if (match.team1Score > match.team2Score) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (match.team1Score < match.team2Score) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }

    home.goalDiff = home.goalsFor - home.goalsAgainst;
    away.goalDiff = away.goalsFor - away.goalsAgainst;
  });

  return Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });
}

export function formatVenueAddress(competition: Competition): string {
  if (competition.venue?.fullAddress) {
    const raw = competition.venue.fullAddress;
    return i18n.locale === 'en' ? localizeContentText(raw) : raw;
  }
  const v = competition.venue;
  if (!v) {
    return t('screens.venueNotSet');
  }
  const sep = i18n.locale === 'en' ? ', ' : '، ';
  const parts = [
    v.name,
    v.neighborhood,
    v.street,
    v.buildingNumber,
    v.city,
    v.region,
    v.country,
  ].filter(Boolean) as string[];

  if (i18n.locale === 'en') {
    return parts.map((p) => localizeContentText(p)).join(sep);
  }
  return parts.join(sep);
}

import { matchesSearchQuery } from '@/utils/search';

function normalizePlace(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function placesOverlap(a?: string, b?: string): boolean {
  const left = normalizePlace(a);
  const right = normalizePlace(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export type UserLocationFields = {
  country?: string;
  region?: string;
  city?: string;
  pinnedCompetitionIds?: string[];
};

/** هل حدّد المتابع عنواناً (دولة / منطقة / مدينة) */
export function userHasLocation(
  user: UserLocationFields | null | undefined
): boolean {
  return !!(
    user?.city?.trim() ||
    user?.region?.trim() ||
    user?.country?.trim()
  );
}

/** تطابق بطولة مع عنوان المتابع (مدينة ثم منطقة ثم دولة) */
export function competitionMatchesUserLocation(
  competition: Competition,
  user: UserLocationFields | null | undefined
): boolean {
  if (!user) return false;
  const venue = competition.venue;
  if (!venue) return false;

  const city = user.city?.trim();
  const region = user.region?.trim();
  const country = user.country?.trim();

  if (
    city &&
    (placesOverlap(city, venue.city) ||
      placesOverlap(city, venue.region) ||
      placesOverlap(city, venue.neighborhood) ||
      placesOverlap(city, venue.fullAddress))
  ) {
    return true;
  }

  if (
    region &&
    (placesOverlap(region, venue.region) ||
      placesOverlap(region, venue.city) ||
      placesOverlap(region, venue.fullAddress))
  ) {
    return true;
  }

  if (
    country &&
    (placesOverlap(country, venue.country) ||
      placesOverlap(country, venue.region) ||
      placesOverlap(country, venue.fullAddress))
  ) {
    return true;
  }

  return false;
}

/** بحث حر عن بطولة بالاسم أو الدولة أو المدينة أو المنطقة أو العنوان */
export function competitionMatchesPlaceQuery(
  competition: Competition,
  query: string
): boolean {
  const venue = competition.venue;
  return matchesSearchQuery(
    query,
    competition.name,
    competition.visibleId,
    venue?.name,
    venue?.country,
    venue?.region,
    venue?.city,
    venue?.neighborhood,
    venue?.fullAddress
  );
}

/** دول ومدن متاحة من بطولات نشطة — لمحرك الاستكشاف */
export function listCompetitionPlaceOptions(competitions: Competition[]): {
  countries: string[];
  cities: string[];
} {
  const countries = new Set<string>();
  const cities = new Set<string>();
  competitions.forEach((c) => {
    if (c.status !== 'active') return;
    const country = c.venue?.country?.trim();
    const city = c.venue?.city?.trim();
    if (country) countries.add(country);
    if (city) cities.add(city);
  });
  const sortAr = (a: string, b: string) => a.localeCompare(b, 'ar');
  return {
    countries: [...countries].sort(sortAr),
    cities: [...cities].sort(sortAr),
  };
}

/** بطولات الرئيسية: عنوان المتابع + المثبتة.
 * إن لم يُحدَّد عنوان بعد نعرض كل المسابقات النشطة. */
export function selectHomeCompetitions(
  competitions: Competition[],
  user: UserLocationFields | null | undefined
): Competition[] {
  const pinned = new Set(user?.pinnedCompetitionIds || []);
  const hasLocation = userHasLocation(user);
  return competitions
    .filter(
      (c) =>
        c.status === 'active' &&
        (pinned.has(c.id) ||
          !hasLocation ||
          competitionMatchesUserLocation(c, user))
    )
    .sort((a, b) => {
      const aPinned = pinned.has(a.id) ? 0 : 1;
      const bPinned = pinned.has(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      return a.id.localeCompare(b.id);
    });
}


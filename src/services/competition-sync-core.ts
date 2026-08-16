import type { Competition, CompetitionRequest } from '@/data/initial-data';

export const COMPETITION_REQUESTS_KEY = 'seellie.competitionRequests';
export const COMPETITIONS_KEY = 'seellie.competitions';

function toIso(value: Date | string | undefined): string | undefined {
  if (value == null) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function reviveCompetitionRequest(
  request: CompetitionRequest
): CompetitionRequest {
  return {
    ...request,
    termsAcceptedAt: new Date(request.termsAcceptedAt),
    requestedAt: new Date(request.requestedAt),
    reviewedAt: request.reviewedAt
      ? new Date(request.reviewedAt)
      : undefined,
  };
}

export function serializeCompetitionRequest(
  request: CompetitionRequest
): CompetitionRequest {
  return {
    ...request,
    termsAcceptedAt: toIso(request.termsAcceptedAt)!,
    requestedAt: toIso(request.requestedAt)!,
    reviewedAt: toIso(request.reviewedAt),
  };
}

function reviveMatchDates(competition: Competition): Competition {
  return {
    ...competition,
    matches: (competition.matches ?? []).map((match) => ({
      ...match,
      date:
        match.date != null
          ? new Date(match.date as Date | string)
          : new Date(),
    })),
  };
}

export function reviveCompetitions(items: Competition[]): Competition[] {
  return items.map(reviveMatchDates);
}

export function mergeCompetitionsById(
  seed: Competition[],
  stored: Competition[]
): Competition[] {
  if (!stored.length) return seed;
  const map = new Map<string, Competition>();
  for (const item of seed) map.set(item.id, item);
  for (const item of stored) map.set(item.id, item);
  return Array.from(map.values());
}

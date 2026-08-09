import type {
  Comment,
  Competition,
  CompetitionRequest,
  GiftTransaction,
  Offer,
  User,
} from '@/data/initial-data';
import { isUuid } from '@/services/supabase-messages';

/** مسابقات البذرة: comp-1, comp-2, … */
export function isSeedCompetitionId(id: string | undefined | null): boolean {
  return !!id && /^comp-\d+$/i.test(id);
}

/** حسابات تجريبية: organizer-1, follower-2, freelancer-1, … */
export function isSeedUserId(id: string | undefined | null): boolean {
  return !!id && /^(organizer|follower|freelancer)-\d+$/i.test(id);
}

export function isSeedCommentId(id: string | undefined | null): boolean {
  return !!id && /^(comment|reply)[-_]/i.test(id);
}

/** يفرّغ منشورات/وسائط/تحليلات الحسابات التجريبية دون حذف الصف نفسه */
export function clearSeedUserContent(user: User): User {
  if (!isSeedUserId(user.id)) return user;
  return {
    ...user,
    posts: [],
    media: { photos: [], videos: [] },
    analysisContent: [],
    personalityPhotos: [],
    comments: [],
  };
}

export function filterSeedCompetitions(
  items: Competition[]
): Competition[] {
  return items.filter((c) => !isSeedCompetitionId(c.id));
}

export function filterSeedComments(items: Comment[]): Comment[] {
  return items.filter(
    (c) =>
      isUuid(c.authorId) &&
      !isSeedCommentId(c.id) &&
      !isSeedUserId(c.authorId)
  );
}

export function filterSeedOffers(items: Offer[]): Offer[] {
  return items.filter(
    (o) => !isSeedUserId(o.organizerId) && !isSeedUserId(o.freelancerId)
  );
}

export function filterSeedGifts(
  items: GiftTransaction[]
): GiftTransaction[] {
  return items.filter(
    (g) => !isSeedUserId(g.gifterId) && !isSeedUserId(g.recipientId)
  );
}

export function filterSeedCompetitionRequests(
  items: CompetitionRequest[]
): CompetitionRequest[] {
  return items.filter(
    (r) =>
      !isSeedUserId(r.organizerId) &&
      (!r.competitionId || !isSeedCompetitionId(r.competitionId))
  );
}

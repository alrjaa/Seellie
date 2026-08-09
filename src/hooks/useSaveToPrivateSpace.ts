import { useCallback } from 'react';
import { useTournament } from '@/providers/TournamentProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { addPrivateContent } from '@/services/private-space';
import { isUuid } from '@/services/supabase-messages';
import type { FullScreenContent } from '@/components/media/FullScreenFeed';

/** حفظ محتوى في المساحة الخاصة بنقرتين */
export function useSaveToPrivateSpace() {
  const { currentUser, competitions, users } = useTournament();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useCallback(
    async (item: FullScreenContent) => {
      if (!currentUser?.id) return;

      let authorId = item.authorId;
      let authorName = item.authorName;
      let authorHandle = item.authorHandle;

      // وسائط المسابقة/المباراة غالباً تحمل id المسابقة وليس حساب المنظّم
      if (authorId) {
        const asCompetition = competitions.find((c) => c.id === authorId);
        const asMatch = competitions.find((c) =>
          c.matches.some((m) => m.id === authorId)
        );
        const comp = asCompetition || asMatch;
        if (comp?.organizerId) {
          authorId = comp.organizerId;
          const organizer = users.find((u) => u.id === comp.organizerId);
          authorName = organizer?.name || authorName || comp.name;
          authorHandle = organizer?.handle || authorHandle;
        }
      }

      // لا تحفظ معرفاً غير حساب سحابي كصديق محتمل
      if (authorId && !isUuid(authorId)) {
        const byName = users.find(
          (u) =>
            u.name.trim().toLowerCase() ===
            (authorName || '').trim().toLowerCase()
        );
        authorId = byName?.id;
        if (byName) {
          authorHandle = byName.handle || authorHandle;
          authorName = byName.name;
        }
      }

      const result = await addPrivateContent(currentUser.id, {
        kind: item.kind,
        mediaUrl: item.mediaUrl,
        title: item.title,
        text: item.text,
        authorId,
        authorName: authorName || t('privateSpace.unknownAuthor'),
        authorHandle,
        sourceId: item.id,
      });
      toast({
        variant: result.added ? 'success' : 'default',
        title: result.added
          ? t('privateSpace.savedToast')
          : t('privateSpace.alreadySaved'),
      });
    },
    [competitions, currentUser?.id, t, toast, users]
  );
}

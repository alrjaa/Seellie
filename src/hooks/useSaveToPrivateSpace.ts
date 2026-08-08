import { useCallback } from 'react';
import { useTournament } from '@/providers/TournamentProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { addPrivateContent } from '@/services/private-space';
import type { FullScreenContent } from '@/components/media/FullScreenFeed';

/** حفظ محتوى في المساحة الخاصة بنقرتين */
export function useSaveToPrivateSpace() {
  const { currentUser } = useTournament();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useCallback(
    async (item: FullScreenContent) => {
      if (!currentUser?.id) return;
      const result = await addPrivateContent(currentUser.id, {
        kind: item.kind,
        mediaUrl: item.mediaUrl,
        title: item.title,
        text: item.text,
        authorId: undefined,
        authorName: item.authorName,
        authorHandle: item.authorHandle,
        sourceId: item.id,
      });
      toast({
        variant: result.added ? 'success' : 'default',
        title: result.added
          ? t('privateSpace.savedToast')
          : t('privateSpace.alreadySaved'),
      });
    },
    [currentUser?.id, toast, t]
  );
}

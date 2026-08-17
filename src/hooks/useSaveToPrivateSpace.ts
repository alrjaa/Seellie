import { useCallback } from 'react';
import { useTournament } from '@/providers/TournamentProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { addPrivateContent } from '@/services/private-space';
import { isUuid } from '@/services/supabase-messages';
import type { FullScreenContent } from '@/components/media/FullScreenFeed';

/**
 * يحفظ المحتوى في الخاصة مع إسناد «الرافع» إلى حساب سحابي قابل للإضافة كصديق
 * (منظّم المسابقة للفيديوهات/الصور، أو صاحب الحساب للمنشورات الشخصية).
 */
export function useSaveToPrivateSpace() {
  const { currentUser, competitions, users } = useTournament();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useCallback(
    async (item: FullScreenContent) => {
      if (!currentUser?.id) return;
      if (item.sponsored) return;

      let authorId = item.authorId?.trim() || undefined;
      let authorName = item.authorName;
      let authorHandle = item.authorHandle;

      const applyOrganizer = (organizerId: string, fallbackName?: string) => {
        authorId = organizerId;
        const organizer = users.find((u) => u.id === organizerId);
        authorName = organizer?.name || fallbackName || authorName;
        authorHandle = organizer?.handle || authorHandle;
      };

      if (authorId) {
        const asCompetition = competitions.find((c) => c.id === authorId);
        if (asCompetition?.organizerId) {
          applyOrganizer(asCompetition.organizerId, asCompetition.name);
        } else {
          const asMatch = competitions.find((c) =>
            c.matches.some((m) => m.id === authorId)
          );
          if (asMatch?.organizerId) {
            applyOrganizer(asMatch.organizerId, asMatch.name);
          } else {
            const asPlayerOwner = competitions.find((c) =>
              c.teams.some((team) =>
                team.players.some((p) => p.id === authorId)
              )
            );
            if (asPlayerOwner?.organizerId) {
              // وسائط اللاعب داخل مسابقة → الرافع هو المنظّم
              applyOrganizer(asPlayerOwner.organizerId, asPlayerOwner.name);
            } else if (isUuid(authorId)) {
              // حساب مستخدم بالفعل — أكمل الاسم/المعرّف إن نقصا
              const user = users.find((u) => u.id === authorId);
              if (user) {
                authorName = user.name || authorName;
                authorHandle = user.handle || authorHandle;
              } else {
                const viaOrg = competitions.find(
                  (c) => c.organizerId === authorId
                );
                if (viaOrg) {
                  applyOrganizer(authorId, viaOrg.name);
                }
              }
            }
          }
        }
      }

      // معرف غير سحابي → حاول المطابقة بالاسم/المعرّف دون مسح إن وُجد بديل
      if (authorId && !isUuid(authorId)) {
        const handleKey = (authorHandle || '')
          .replace(/^@/, '')
          .trim()
          .toLowerCase();
        const nameKey = (authorName || '').trim().toLowerCase();
        const byHandle = handleKey
          ? users.find(
              (u) =>
                (u.handle || '').replace(/^@/, '').toLowerCase() === handleKey
            )
          : undefined;
        const byName = nameKey
          ? users.find((u) => u.name.trim().toLowerCase() === nameKey)
          : undefined;
        const found = byHandle || byName;
        if (found && isUuid(found.id)) {
          authorId = found.id;
          authorName = found.name;
          authorHandle = found.handle || authorHandle;
        } else {
          authorId = undefined;
        }
      }

      // لا تضف نفسك كصديق محتمل
      if (authorId && authorId === currentUser.id) {
        authorId = undefined;
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
        description:
          result.added && authorId
            ? t('privateSpace.savedWithAuthorHint')
            : undefined,
      });
    },
    [competitions, currentUser?.id, t, toast, users]
  );
}

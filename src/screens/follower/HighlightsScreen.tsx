import React, { useCallback, useMemo } from 'react';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import {
  FullScreenFeed,
  type FullScreenContent,
} from '@/components/media/FullScreenFeed';
import { useSaveToPrivateSpace } from '@/hooks/useSaveToPrivateSpace';

type MediaItem = {
  id: string;
  /** match id أو competition id أو player id حسب المصدر */
  ownerId: string;
  source: 'match' | 'competition' | 'player';
  url: string;
  type: 'photo' | 'video';
  matchLabel: string;
  likes: string[];
  organizerId?: string;
  organizerName?: string;
  organizerHandle?: string;
};

function isHttpUrl(url?: string) {
  return !!url && /^https?:\/\//i.test(url.trim());
}

export default function HighlightsScreen() {
  const { competitions, currentUser, toggleMediaLike, users } = useTournament();
  const { t } = useTranslation();
  const saveToPrivate = useSaveToPrivateSpace();

  const media = useMemo(() => {
    const items: MediaItem[] = [];
    competitions.forEach((comp) => {
      const organizer = users.find((u) => u.id === comp.organizerId);
      const organizerName = organizer?.name || comp.name;
      const organizerHandle = organizer?.handle;

      (comp.media?.photos || []).forEach((p) => {
        if (!isHttpUrl(p.url)) return;
        items.push({
          id: p.id,
          ownerId: comp.id,
          source: 'competition',
          url: p.url,
          type: 'photo',
          matchLabel: comp.name,
          likes: p.likes,
          organizerId: comp.organizerId,
          organizerName,
          organizerHandle,
        });
      });
      (comp.media?.videos || []).forEach((v) => {
        if (!isHttpUrl(v.url)) return;
        items.push({
          id: v.id,
          ownerId: comp.id,
          source: 'competition',
          url: v.url,
          type: 'video',
          matchLabel: comp.name,
          likes: v.likes,
          organizerId: comp.organizerId,
          organizerName,
          organizerHandle,
        });
      });

      comp.teams.forEach((team) => {
        team.players.forEach((player) => {
          (player.media?.photos || []).forEach((p) => {
            if (!isHttpUrl(p.url)) return;
            items.push({
              id: p.id,
              ownerId: player.id,
              source: 'player',
              url: p.url,
              type: 'photo',
              matchLabel: `${player.name} · ${team.name}`,
              likes: p.likes,
              organizerId: comp.organizerId,
              organizerName,
              organizerHandle,
            });
          });
          (player.media?.videos || []).forEach((v) => {
            if (!isHttpUrl(v.url)) return;
            items.push({
              id: v.id,
              ownerId: player.id,
              source: 'player',
              url: v.url,
              type: 'video',
              matchLabel: `${player.name} · ${team.name}`,
              likes: v.likes,
              organizerId: comp.organizerId,
              organizerName,
              organizerHandle,
            });
          });
        });
      });

      comp.matches.forEach((match) => {
        const team1 = comp.teams.find((t) => t.id === match.team1Id)?.name;
        const team2 = comp.teams.find((t) => t.id === match.team2Id)?.name;
        const label = `${team1 || '?'} vs ${team2 || '?'}`;
        match.media?.photos?.forEach((p) => {
          if (!isHttpUrl(p.url)) return;
          items.push({
            id: p.id,
            ownerId: match.id,
            source: 'match',
            url: p.url,
            type: 'photo',
            matchLabel: label,
            likes: p.likes,
            organizerId: comp.organizerId,
            organizerName,
            organizerHandle,
          });
        });
        match.media?.videos?.forEach((v) => {
          if (!isHttpUrl(v.url)) return;
          items.push({
            id: v.id,
            ownerId: match.id,
            source: 'match',
            url: v.url,
            type: 'video',
            matchLabel: label,
            likes: v.likes,
            organizerId: comp.organizerId,
            organizerName,
            organizerHandle,
          });
        });
      });
    });
    return items;
  }, [competitions, users]);

  const fullScreenData = useMemo<FullScreenContent[]>(
    () =>
      media.map((item) => ({
        id: `${item.source}-${item.type}-${item.id}`,
        kind: item.type,
        mediaUrl: item.url,
        authorId: item.organizerId,
        authorName: item.organizerName || item.matchLabel,
        authorHandle: item.organizerHandle,
        title: item.matchLabel,
        subtitle:
          item.source === 'competition'
            ? item.type === 'photo'
              ? t('screens.competitionClipPhoto')
              : t('screens.competitionClipVideo')
            : item.source === 'player'
              ? item.type === 'photo'
                ? t('screens.playerClipPhoto')
                : t('screens.playerClipVideo')
              : item.type === 'photo'
                ? t('screens.matchClipPhoto')
                : t('screens.matchClipVideo'),
        likes: item.likes,
        liked: !!currentUser && item.likes.includes(currentUser.id),
      })),
    [media, currentUser, t]
  );

  const onFullLike = useCallback(
    (item: FullScreenContent) => {
      const source = media.find(
        (m) => `${m.source}-${m.type}-${m.id}` === item.id
      );
      if (!source) return;
      toggleMediaLike(source.ownerId, source.id, source.type, source.source);
    },
    [media, toggleMediaLike]
  );

  return (
    <Screen bleed edges={['left', 'right']}>
      <FullScreenFeed
        data={fullScreenData}
        onLike={onFullLike}
        onDoubleTap={(item) => void saveToPrivate(item)}
        emptyTitle={t('screens.noHighlights')}
        emptyDescription={t('screens.noHighlightsDesc')}
        emptyIcon="images-outline"
      />
    </Screen>
  );
}

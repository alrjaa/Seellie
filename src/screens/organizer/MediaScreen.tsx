import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card, Muted, Subtitle, Title } from '@/components/ui';

type MediaItem = {
  id: string;
  url: string;
  kind: 'photo' | 'video';
  competitionName: string;
};

export default function MediaScreen() {
  const { competitions, currentUser } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();

  const items = useMemo(() => {
    const list = currentUser
      ? competitions.filter((c) => c.organizerId === currentUser.id)
      : [];

    const media: MediaItem[] = [];
    list.forEach((c) => {
      c.media.photos.forEach((p) =>
        media.push({
          id: p.id,
          url: p.url,
          kind: 'photo',
          competitionName: c.name,
        })
      );
      c.media.videos.forEach((v) =>
        media.push({
          id: v.id,
          url: v.url,
          kind: 'video',
          competitionName: c.name,
        })
      );
      c.teams.forEach((team) => {
        team.players.forEach((pl) => {
          pl.media.photos.forEach((p) =>
            media.push({
              id: `${pl.id}-${p.id}`,
              url: p.url,
              kind: 'photo',
              competitionName: c.name,
            })
          );
          pl.media.videos.forEach((v) =>
            media.push({
              id: `${pl.id}-${v.id}`,
              url: v.url,
              kind: 'video',
              competitionName: c.name,
            })
          );
        });
      });
    });
    return media;
  }, [competitions, currentUser]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('organizer.media.title')}</Title>
      <Muted>{t('organizer.media.subtitle')}</Muted>

      {items.length === 0 ? (
        <EmptyState
          title={t('organizer.media.empty')}
          description={t('organizer.media.emptyDesc')}
          icon="images-outline"
        />
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <Card key={item.id} style={styles.tile}>
              {item.kind === 'photo' ? (
                <Image source={{ uri: item.url }} style={styles.image} />
              ) : (
                <View
                  style={[
                    styles.videoPlaceholder,
                    { backgroundColor: theme.colors.inputBg },
                  ]}
                >
                  <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>
                    {t('common.video')}
                  </Text>
                </View>
              )}
              <Subtitle>{item.competitionName}</Subtitle>
              <Muted>
                {item.kind === 'photo' ? t('common.photo') : t('common.video')}
              </Muted>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', gap: 6, flexGrow: 1, minWidth: 150 },
  image: { width: '100%', height: 120, borderRadius: 10 },
  videoPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

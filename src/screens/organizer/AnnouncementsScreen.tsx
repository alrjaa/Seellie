import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/providers/ToastProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useTournament } from '@/providers/TournamentProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { formatArabicDate } from '@/utils';
import { createId } from '@/utils/id';
import { getJson, setJson } from '@/services/storage';
import { fetchAppBlob, upsertAppBlob } from '@/services/supabase-app-blobs';
import { isUuid } from '@/services/supabase-messages';

type Announcement = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  organizerId: string;
  competitionId?: string;
};

const STORAGE_PREFIX = 'seellie.organizer.announcements.v1';

export default function AnnouncementsScreen() {
  const { toast } = useToast();
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { currentUser, competitions } = useTournament();
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const storageKey = currentUser?.id
    ? `${STORAGE_PREFIX}.${currentUser.id}`
    : STORAGE_PREFIX;

  const myCompetitionId = competitions.find(
    (c) => c.organizerId === currentUser?.id
  )?.id;

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await getJson<Announcement[]>(storageKey);
      let next = Array.isArray(stored) ? stored : [];
      if (currentUser?.id && isUuid(currentUser.id)) {
        const cloud = await fetchAppBlob<Announcement[]>(
          `announcements:${currentUser.id}`
        );
        if (Array.isArray(cloud.data) && cloud.data.length) {
          next = cloud.data;
        }
      }
      if (!active) return;
      setItems(next);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [currentUser?.id, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    void setJson(storageKey, items);
    if (currentUser?.id && isUuid(currentUser.id)) {
      void upsertAppBlob(`announcements:${currentUser.id}`, items).then(
        (res) => {
          if (!res.ok) {
            toast({
              variant: 'destructive',
              title: t('cloud.competitionSyncFailed'),
              description: res.error,
            });
          }
        }
      );
    }
  }, [items, hydrated, currentUser?.id, storageKey, toast, t]);

  const mine = items.filter((a) => a.organizerId === currentUser?.id);

  const addAnnouncement = () => {
    if (!currentUser || !title.trim() || !body.trim()) return;
    setItems((prev) => [
      {
        id: createId('ann'),
        title: title.trim(),
        body: body.trim(),
        createdAt: new Date().toISOString(),
        organizerId: currentUser.id,
        competitionId: myCompetitionId,
      },
      ...prev,
    ]);
    setTitle('');
    setBody('');
    toast({
      variant: 'success',
      title: t('organizer.announcements.published'),
      description: t('organizer.announcements.publishedDesc'),
    });
  };

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('organizer.announcements.title')}</Title>
      <Muted>{t('organizer.announcements.subtitle')}</Muted>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.announcements.newAnnouncement')}</Subtitle>
        <Input
          label={t('organizer.announcements.titleLabel')}
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label={t('organizer.announcements.contentLabel')}
          value={body}
          onChangeText={setBody}
          multiline
        />
        <Button
          label={t('organizer.announcements.publish')}
          onPress={addAnnouncement}
        />
      </Card>

      {mine.length === 0 ? (
        <EmptyState
          title={t('organizer.announcements.empty')}
          description={t('organizer.announcements.emptyDesc')}
          icon="megaphone-outline"
        />
      ) : (
        mine.map((a) => (
          <Card key={a.id} style={styles.card}>
            <View
              style={[
                styles.row,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Subtitle>{a.title}</Subtitle>
                <Text
                  style={[
                    styles.body,
                    {
                      color: theme.colors.text,
                      textAlign: 'left',
                    },
                  ]}
                >
                  {a.body}
                </Text>
                <Muted>{formatArabicDate(new Date(a.createdAt))}</Muted>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('superadmin.actions.delete')}
                onPress={() => {
                  setItems((prev) => prev.filter((x) => x.id !== a.id));
                  toast({
                    title: t('organizer.announcements.deleted'),
                    description: t('organizer.announcements.deletedDesc'),
                  });
                }}
              >
                <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>
                  {t('superadmin.actions.delete')}
                </Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 12, paddingBottom: 40 },
  card: { gap: 10 },
  row: { gap: 10, alignItems: 'flex-start' },
  body: { lineHeight: 20 },
});

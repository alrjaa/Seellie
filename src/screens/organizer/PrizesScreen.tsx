import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useTournament } from '@/providers/TournamentProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { createId } from '@/utils/id';
import { getJson, setJson } from '@/services/storage';
import { fetchAppBlob, upsertAppBlob } from '@/services/supabase-app-blobs';
import { isUuid } from '@/services/supabase-messages';

type Prize = {
  id: string;
  place: string;
  title: string;
  value: string;
  organizerId: string;
  competitionId?: string;
};

const STORAGE_PREFIX = 'seellie.organizer.prizes.v1';

export default function PrizesScreen() {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { toast } = useToast();
  const { currentUser, competitions } = useTournament();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [place, setPlace] = useState('');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
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
      const stored = await getJson<Prize[]>(storageKey);
      let next = Array.isArray(stored) ? stored : [];
      if (currentUser?.id && isUuid(currentUser.id)) {
        const cloud = await fetchAppBlob<Prize[]>(`prizes:${currentUser.id}`);
        if (Array.isArray(cloud.data) && cloud.data.length) {
          next = cloud.data;
        }
      }
      if (!active) return;
      setPrizes(next);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [currentUser?.id, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    void setJson(storageKey, prizes);
    if (currentUser?.id && isUuid(currentUser.id)) {
      void upsertAppBlob(`prizes:${currentUser.id}`, prizes).then((res) => {
        if (!res.ok) {
          toast({
            variant: 'destructive',
            title: t('cloud.competitionSyncFailed'),
            description: res.error,
          });
        }
      });
    }
  }, [prizes, hydrated, currentUser?.id, storageKey, toast, t]);

  const mine = prizes.filter((p) => p.organizerId === currentUser?.id);

  const addPrize = () => {
    if (!currentUser || !place.trim() || !title.trim()) return;
    setPrizes((prev) => [
      ...prev,
      {
        id: createId('prize'),
        place: place.trim(),
        title: title.trim(),
        value: value.trim() || '—',
        organizerId: currentUser.id,
        competitionId: myCompetitionId,
      },
    ]);
    setPlace('');
    setTitle('');
    setValue('');
    toast({
      variant: 'success',
      title: t('organizer.prizes.added'),
    });
  };

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('organizer.prizes.title')}</Title>
      <Muted>{t('organizer.prizes.subtitle')}</Muted>

      {mine.length === 0 ? (
        <EmptyState
          title={t('organizer.prizes.empty')}
          description={t('organizer.prizes.emptyDesc')}
          icon="trophy-outline"
        />
      ) : (
        mine.map((p) => (
          <Card key={p.id} style={styles.card}>
            <View
              style={[
                styles.row,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Subtitle>{p.place}</Subtitle>
                <Text
                  style={[
                    styles.prizeTitle,
                    {
                      color: theme.colors.text,
                      textAlign: 'left',
                    },
                  ]}
                >
                  {p.title}
                </Text>
                <Muted>{p.value}</Muted>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('superadmin.actions.delete')}
                onPress={() =>
                  setPrizes((prev) => prev.filter((x) => x.id !== p.id))
                }
              >
                <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>
                  {t('superadmin.actions.delete')}
                </Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      <Card style={styles.card}>
        <Subtitle>{t('organizer.prizes.addPrize')}</Subtitle>
        <Input
          label={t('organizer.prizes.place')}
          value={place}
          onChangeText={setPlace}
        />
        <Input
          label={t('organizer.prizes.prizeName')}
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label={t('organizer.prizes.value')}
          value={value}
          onChangeText={setValue}
        />
        <Button label={t('superadmin.actions.add')} onPress={addPrize} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 12, paddingBottom: 40 },
  card: { gap: 10 },
  row: { alignItems: 'flex-start', gap: 10 },
  prizeTitle: { fontWeight: '800', fontSize: 15 },
});

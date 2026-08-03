import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';

type Prize = {
  id: string;
  place: string;
  title: string;
  value: string;
};

const INITIAL_PRIZES: Prize[] = [];

export default function PrizesScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [prizes, setPrizes] = useState<Prize[]>(INITIAL_PRIZES);
  const [place, setPlace] = useState('');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');

  const addPrize = () => {
    if (!place.trim() || !title.trim()) return;
    setPrizes((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        place: place.trim(),
        title: title.trim(),
        value: value.trim() || '—',
      },
    ]);
    setPlace('');
    setTitle('');
    setValue('');
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('organizer.prizes.title')}</Title>
      <Muted>{t('organizer.prizes.subtitle')}</Muted>

      {prizes.map((p) => (
        <Card key={p.id} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 4 }}>
              <Subtitle>{p.place}</Subtitle>
              <Text style={[styles.prizeTitle, { color: theme.colors.text }]}>
                {p.title}
              </Text>
              <Muted>{p.value}</Muted>
            </View>
            <Pressable
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
      ))}

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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  prizeTitle: { fontWeight: '800', textAlign: 'left', fontSize: 15 },
});

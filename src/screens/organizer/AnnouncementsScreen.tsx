import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/providers/ToastProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { formatArabicDate } from '@/utils';

type Announcement = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
};

export default function AnnouncementsScreen() {
  const { toast } = useToast();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const addAnnouncement = () => {
    if (!title.trim() || !body.trim()) return;
    setItems((prev) => [
      {
        id: String(Date.now()),
        title: title.trim(),
        body: body.trim(),
        createdAt: new Date(),
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
    <Screen scroll contentStyle={styles.content}>
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

      {items.length === 0 ? (
        <EmptyState
          title={t('organizer.announcements.empty')}
          description={t('organizer.announcements.emptyDesc')}
          icon="megaphone-outline"
        />
      ) : (
        items.map((a) => (
          <Card key={a.id} style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Subtitle>{a.title}</Subtitle>
                <Text style={[styles.body, { color: theme.colors.text }]}>
                  {a.body}
                </Text>
                <Muted>{formatArabicDate(a.createdAt)}</Muted>
              </View>
              <Pressable
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
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  body: { textAlign: 'left', lineHeight: 20 },
});

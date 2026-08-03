import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { createId } from '@/utils/id';
import { useTournament } from '@/providers/TournamentProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';

export default function CreateContentScreen() {
  const { currentUser, updateUser } = useTournament();
  const { toast } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const [text, setText] = useState('');

  if (!currentUser) return null;

  const publish = () => {
    const value = text.trim();
    if (!value) return;

    const post = {
      id: createId(),
      text: value,
      timestamp: new Date(),
      likes: [] as string[],
    };

    updateUser(
      {
        ...currentUser,
        posts: [post, ...currentUser.posts],
      },
      t('create.contentPublished')
    );
    toast({
      variant: 'success',
      title: t('create.publishedTitle'),
      description: t('create.publishedDesc'),
    });
    setText('');
    router.back();
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('create.contentTitle')}</Title>
      <Muted>{t('create.contentSubtitle')}</Muted>

      <Card style={styles.card}>
        <Subtitle>{t('create.postText')}</Subtitle>
        <Input
          label={t('create.contentLabel')}
          value={text}
          onChangeText={setText}
          multiline
          placeholder={t('create.contentPlaceholder')}
          style={{ minHeight: 120, maxHeight: 220 }}
        />
        <Button
          label={t('create.publish')}
          onPress={publish}
          disabled={!text.trim()}
        />
        <Button
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 10 },
});

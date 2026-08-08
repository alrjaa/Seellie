import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Muted, Subtitle, Title } from '@/components/ui';

type Props = {
  kind: 'privacy' | 'terms';
};

export default function LegalScreen({ kind }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const isPrivacy = kind === 'privacy';

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>
        {isPrivacy ? t('legal.privacyTitle') : t('legal.termsTitle')}
      </Title>
      <Muted>
        {isPrivacy ? t('legal.privacyUpdated') : t('legal.termsUpdated')}
      </Muted>

      <Card style={styles.card}>
        <Subtitle>
          {isPrivacy ? t('legal.privacyS1Title') : t('legal.termsS1Title')}
        </Subtitle>
        <Muted>
          {isPrivacy ? t('legal.privacyS1Body') : t('legal.termsS1Body')}
        </Muted>
      </Card>

      <Card style={styles.card}>
        <Subtitle>
          {isPrivacy ? t('legal.privacyS2Title') : t('legal.termsS2Title')}
        </Subtitle>
        <Muted>
          {isPrivacy ? t('legal.privacyS2Body') : t('legal.termsS2Body')}
        </Muted>
      </Card>

      <Card style={styles.card}>
        <Subtitle>
          {isPrivacy ? t('legal.privacyS3Title') : t('legal.termsS3Title')}
        </Subtitle>
        <Muted>
          {isPrivacy ? t('legal.privacyS3Body') : t('legal.termsS3Body')}
        </Muted>
      </Card>

      <Button
        label={t('common.back')}
        variant="ghost"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 12, paddingBottom: 40 },
  card: { gap: 8 },
});

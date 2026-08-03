import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { ListRow } from '@/components/ui/ListRow';
import { Muted, Title } from '@/components/ui';
import { MORE_MODULES } from './modules';

export default function MoreScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('nav.more')}</Title>
      <Muted>{t('organizer.more.subtitle')}</Muted>

      <View style={styles.list}>
        {MORE_MODULES.map((module) => (
          <ListRow
            key={module.key}
            title={t(`organizer.modules.${module.key}.title`)}
            subtitle={t(`organizer.modules.${module.key}.description`)}
            icon="chevron-back"
            onPress={() => router.push(module.href as any)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  list: { gap: 10 },
});

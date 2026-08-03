import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Button, Title } from '@/components/ui';

export default function NotFoundScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('nav.notFound') }} />
      <View
        style={[
          styles.wrap,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Title>{t('nav.notFound')}</Title>
        <Button label={t('nav.goHome')} onPress={() => router.replace('/')} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
});

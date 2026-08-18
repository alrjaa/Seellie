import { Stack } from 'expo-router';
import { useAppTheme } from '@/providers/ThemeProvider';

/** بوابة المعلن — ads.seellie.com */
export default function AdsPortalLayout() {
  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background, flex: 1 },
        animation: 'fade',
      }}
    />
  );
}

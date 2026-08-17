import { Stack } from 'expo-router';
import { useAppTheme } from '@/providers/ThemeProvider';

export default function AdsPortalLayout() {
  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'fade',
      }}
    />
  );
}

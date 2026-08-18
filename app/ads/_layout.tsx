import { Stack } from 'expo-router';
import { useAppTheme } from '@/providers/ThemeProvider';

/** بوابة المعلن — ads.seellie.com */
export default function AdsPortalLayout() {
  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="home" />
      <Stack.Screen name="campaign/new" />
      <Stack.Screen name="campaign/[id]" />
      <Stack.Screen name="ad/new" />
      <Stack.Screen name="ad/[id]" />
    </Stack>
  );
}

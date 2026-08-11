import { Stack } from 'expo-router';
import { useAppTheme } from '@/providers/ThemeProvider';

/**
 * بوابة المشرف المستقلة تحت /admin/*
 * الدخول: /admin — اللوحة: /admin/home, /admin/users, …
 */
export default function AdminPortalLayout() {
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
      <Stack.Screen name="(console)" />
    </Stack>
  );
}

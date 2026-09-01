import { Stack } from 'expo-router';
import { transparentHeaderOptions } from '@/theme/navigation';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SportsLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        ...transparentHeaderOptions(theme, insets.top),
        headerShown: false,
      }}
    />
  );
}

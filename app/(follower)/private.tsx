import React, { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PrivateScreen from '@/screens/follower/PrivateScreen';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

type BoundaryState = { error: Error | null };

class PrivateRouteBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[PrivateRoute]', error?.message, info?.componentStack);
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}

function PrivateErrorFallback({ onRetry }: { onRetry: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.colors.background }]}
    >
      <Text
        style={[styles.title, cairoText('bold'), { color: theme.colors.text }]}
      >
        {t('privateSpace.title')}
      </Text>
      <Text style={[styles.body, { color: theme.colors.textMuted }]}>
        {t('privateSpace.screenError')}
      </Text>
      <Pressable
        onPress={onRetry}
        style={[styles.btn, { backgroundColor: theme.colors.accent }]}
        accessibilityRole="button"
      >
        <Text
          style={[cairoText('semiBold'), { color: theme.colors.textInverse }]}
        >
          {t('common.retry')}
        </Text>
      </Pressable>
    </View>
  );
}

export default function PrivateRoute() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <PrivateRouteBoundary
      key={resetKey}
      fallback={
        <PrivateErrorFallback onRetry={() => setResetKey((k) => k + 1)} />
      }
    >
      <PrivateScreen />
    </PrivateRouteBoundary>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 18, textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  btn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
});

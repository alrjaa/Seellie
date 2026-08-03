import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';
import { headerSafeTop } from '@/theme/navigation';

export type ToastVariant = 'default' | 'success' | 'destructive';

export type ToastPayload = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  toast: (payload: ToastPayload) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setPayload(null));
  }, [opacity, translateY]);

  const toast = useCallback(
    (next: ToastPayload) => {
      if (timer.current) clearTimeout(timer.current);
      setPayload(next);
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      timer.current = setTimeout(hide, next.durationMs ?? 2800);
    },
    [hide, opacity, translateY]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  const bg =
    payload?.variant === 'destructive'
      ? theme.colors.danger
      : payload?.variant === 'success'
        ? theme.colors.primary
        : theme.colors.surfaceElevated;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {payload ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              top: headerSafeTop(insets.top),
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Pressable
            accessibilityRole="alert"
            onPress={hide}
            style={[
              styles.toast,
              {
                backgroundColor: bg,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.title,
                {
                  color:
                    payload.variant === 'default'
                      ? theme.colors.text
                      : theme.colors.textInverse,
                },
              ]}
            >
              {payload.title}
            </Text>
            {payload.description ? (
              <Text
                style={[
                  styles.desc,
                  {
                    color:
                      payload.variant === 'default'
                        ? theme.colors.textMuted
                        : theme.colors.textInverse,
                  },
                ]}
              >
                {payload.description}
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  desc: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'left',
    writingDirection: 'ltr',
    lineHeight: 18,
  },
});

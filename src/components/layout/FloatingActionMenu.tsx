import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { floatingAboveTabOffset } from '@/theme/navigation';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useFloatingChrome } from '@/providers/FloatingChromeProvider';
import { useTranslation } from '@/providers/LanguageProvider';

type SideAction = {
  key: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  roles?: Array<'follower' | 'organizer' | 'freelancer' | 'superadmin'>;
};

const ACTIONS: SideAction[] = [
  {
    key: 'unique',
    labelKey: 'menu.unique',
    icon: 'diamond-outline',
    href: '/unique',
  },
  {
    key: 'forums',
    labelKey: 'menu.forums',
    icon: 'chatbox-ellipses-outline',
    href: '/forums',
  },
  {
    key: 'shares',
    labelKey: 'menu.shares',
    icon: 'share-social-outline',
    href: '/shares',
  },
  {
    key: 'search',
    labelKey: 'menu.search',
    icon: 'search-outline',
    href: '/search',
  },
];

/**
 * أزرار عائمة ثابتة على اليسار فعلياً (iOS + Android) —
 * بدون تسميات ظاهرة؛ تظهر التسمية عند اللمس فقط.
 */
function FloatingActionMenuComponent() {
  const { currentUser } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { visible } = useFloatingChrome();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: visible ? 0 : -56,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateX, visible]);

  const actions = useMemo(() => {
    if (!currentUser) return [];
    return ACTIONS.filter(
      (a) => !a.roles || a.roles.includes(currentUser.role)
    ).map((a) => ({ ...a, label: t(a.labelKey) }));
  }, [currentUser, t]);

  if (!currentUser || actions.length === 0) return null;
  if (pathname?.includes('(auth)') || pathname === '/login' || pathname === '/admin') return null;

  const isActive = (href: string) =>
    pathname === href || pathname?.endsWith(href);

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        style={[
          styles.wrap,
          {
            left: 10,
            right: undefined,
            bottom: floatingAboveTabOffset(insets.bottom),
            opacity,
            transform: [{ translateX }],
          },
        ]}
      >
        {actions.map((action) => {
          const active = isActive(action.href);
          const showLabel = pressedKey === action.key;
          return (
            <View key={action.key} style={styles.item}>
              {showLabel ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.tooltip,
                    {
                      backgroundColor: theme.colors.surfaceElevated,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.tooltipText, { color: theme.colors.text }]}
                    numberOfLines={1}
                  >
                    {action.label}
                  </Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPressIn={() => setPressedKey(action.key)}
                onPressOut={() => setPressedKey(null)}
                onPress={() => router.push(action.href as any)}
                hitSlop={6}
                style={[
                  styles.btn,
                  {
                    backgroundColor: active
                      ? theme.colors.primary
                      : theme.colors.surfaceElevated,
                    borderColor: active
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={18}
                  color={
                    active ? theme.colors.textInverse : theme.colors.primary
                  }
                />
              </Pressable>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

export const FloatingActionMenu = memo(FloatingActionMenuComponent);

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    // تثبيت المحاذاة الفيزيائية لليسار بغض النظر عن RTL/LTR
    direction: 'ltr',
  },
  wrap: {
    position: 'absolute',
    gap: 12,
    alignItems: 'flex-start',
    direction: 'ltr',
  },
  item: {
    position: 'relative',
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltip: {
    position: 'absolute',
    left: 52,
    top: 8,
    zIndex: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 140,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

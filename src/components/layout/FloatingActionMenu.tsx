import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
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
import { useTranslation } from '@/providers/LanguageProvider';
import { useFloatingVisibility } from '@/hooks/useFloatingVisibility';
import { forceFloatingVisible } from '@/services/floating-scroll-bus';
import { cairoText } from '@/theme/fonts';
import { useResponsive } from '@/hooks/useResponsive';

type SideAction = {
  key: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
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
  {
    key: 'notifications',
    labelKey: 'notifications.title',
    icon: 'notifications-outline',
    href: '/notifications',
  },
];

const useNativeDriver = Platform.OS !== 'web';

/**
 * أزرار تنقل عائمة — على الجوال ومتصفح الجوال.
 * تُخفى فقط في تخطيط سطح المكتب الواسع (شريط جانبي).
 */
function FloatingActionMenuComponent() {
  const { currentUser } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { visible } = useFloatingVisibility(true);
  const { desktop } = useResponsive();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  useEffect(() => {
    forceFloatingVisible();
    opacity.setValue(1);
    translateY.setValue(0);
  }, [pathname, opacity, translateY]);

  useEffect(() => {
    if (Platform.OS === 'web') forceFloatingVisible();
  }, []);

  useEffect(() => {
    if (visible) {
      opacity.setValue(1);
      translateY.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        toValue: 18,
        duration: 140,
        easing: Easing.in(Easing.cubic),
        useNativeDriver,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  const actions = useMemo(() => {
    if (!currentUser) return [];
    const active = currentUser.activeRole || currentUser.role;
    if (active === 'superadmin' || currentUser.role === 'superadmin') {
      return [];
    }
    if (active === 'organizer' || currentUser.role === 'organizer') {
      return ACTIONS.filter((a) =>
        ['search', 'notifications'].includes(a.key)
      ).map((a) => ({ ...a, label: t(a.labelKey) }));
    }
    return ACTIONS.map((a) => ({ ...a, label: t(a.labelKey) }));
  }, [currentUser, t]);

  if (!currentUser || actions.length === 0) return null;
  if (desktop) return null;
  if (
    pathname?.includes('(auth)') ||
    pathname?.includes('(superadmin)') ||
    pathname?.includes('/superadmin') ||
    pathname === '/login' ||
    pathname === '/admin'
  ) {
    return null;
  }

  const isActive = (href: string) =>
    pathname === href || pathname?.endsWith(href);

  const bottom = floatingAboveTabOffset(
    Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 0)
  );

  return (
    <View
      pointerEvents="box-none"
      // @ts-expect-error RN web dataset
      dataSet={{ seellieFab: '1' }}
      style={[styles.layer, Platform.OS === 'web' && styles.layerWeb]}
    >
      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        style={[
          styles.wrap,
          Platform.OS === 'web' && styles.wrapWeb,
          {
            left: 10,
            bottom,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        {actions.map((action) => {
          const active = isActive(action.href);
          const showLabel = pressedKey === action.key;
          return (
            <View
              key={action.key}
              style={[styles.item, showLabel ? styles.itemRaised : null]}
            >
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
                    style={[
                      styles.tooltipText,
                      cairoText('semiBold'),
                      { color: theme.colors.text },
                    ]}
                  >
                    {action.label}
                  </Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPressIn={() => setPressedKey(action.key)}
                onPressOut={() => {
                  setTimeout(() => {
                    setPressedKey((k) => (k === action.key ? null : k));
                  }, 700);
                }}
                onPress={() => router.push(action.href as any)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    backgroundColor: active
                      ? theme.colors.accent
                      : theme.colors.surfaceElevated,
                    borderColor: active
                      ? theme.colors.accent
                      : theme.colors.border,
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={18}
                  color={
                    active ? theme.colors.textInverse : theme.colors.text
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
    zIndex: 999,
    elevation: 999,
    direction: 'ltr',
    overflow: 'visible',
  },
  layerWeb: {
    position: 'fixed' as any,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2147483000,
  },
  wrap: {
    position: 'absolute',
    gap: 12,
    alignItems: 'flex-start',
    direction: 'ltr',
    overflow: 'visible',
  },
  wrapWeb: {
    position: 'fixed' as any,
    zIndex: 2147483001,
  },
  item: {
    position: 'relative',
    width: 44,
    height: 44,
    justifyContent: 'center',
    overflow: 'visible',
  },
  itemRaised: {
    zIndex: 8,
    elevation: 8,
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
    left: 50,
    top: 6,
    zIndex: 10,
    elevation: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 200,
    minWidth: 48,
  },
  tooltipText: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'left',
  },
});

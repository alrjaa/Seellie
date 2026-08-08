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
import { useFloatingChromeVisible } from '@/providers/FloatingChromeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';
import { useResponsive } from '@/hooks/useResponsive';

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
  {
    key: 'notifications',
    labelKey: 'notifications.title',
    icon: 'notifications-outline',
    href: '/notifications',
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
  const { visible } = useFloatingChromeVisible();
  const { desktop } = useResponsive();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: visible ? 0 : -40,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateX, visible]);

  const actions = useMemo(() => {
    if (!currentUser) return [];
    const active = currentUser.activeRole || currentUser.role;
    if (active === 'superadmin' || currentUser.role === 'superadmin') {
      return [];
    }
    // المنظم: بحث + إشعارات فقط (المشاركة من على المحتوى/اللاعبين)
    if (active === 'organizer' || currentUser.role === 'organizer') {
      return ACTIONS.filter((a) =>
        ['search', 'notifications'].includes(a.key)
      ).map((a) => ({ ...a, label: t(a.labelKey) }));
    }
    return ACTIONS.filter(
      (a) => !a.roles || a.roles.includes(currentUser.role as any)
    ).map((a) => ({ ...a, label: t(a.labelKey) }));
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
                  // إبقاء الاسم لحظة قصيرة ليُقرأ كاملاً
                  setTimeout(() => {
                    setPressedKey((k) => (k === action.key ? null : k));
                  }, 700);
                }}
                onPress={() => router.push(action.href as any)}
                hitSlop={6}
                style={[
                  styles.btn,
                  {
                    backgroundColor: active
                      ? theme.colors.accent
                      : theme.colors.surfaceElevated,
                    borderColor: active
                      ? theme.colors.accent
                      : theme.colors.border,
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
    zIndex: 40,
    elevation: 40,
    // تثبيت المحاذاة الفيزيائية لليسار بغض النظر عن RTL/LTR
    direction: 'ltr',
    overflow: 'visible',
  },
  wrap: {
    position: 'absolute',
    gap: 12,
    alignItems: 'flex-start',
    direction: 'ltr',
    overflow: 'visible',
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
    // بدون قصّ — يظهر الاسم كاملاً
    maxWidth: 200,
    minWidth: 48,
  },
  tooltipText: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'left',
  },
});

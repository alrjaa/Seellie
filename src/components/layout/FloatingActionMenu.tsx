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
import {
  forceFloatingVisible,
  isFloatingSuppressed,
} from '@/services/floating-scroll-bus';
import {
  subscribeContentAuthorFocus,
  type ContentAuthorFocus,
} from '@/services/content-author-bus';
import { Avatar } from '@/components/ui';
import { cairoText } from '@/theme/fonts';
import { useResponsive } from '@/hooks/useResponsive';
import { ensureSocialLists } from '@/utils/social-stats';
import type { FabIconConfig } from '@/types/fab-icons';

const useNativeDriver = Platform.OS !== 'web';

function isIoniconName(
  name: string
): name is keyof typeof Ionicons.glyphMap {
  return name in Ionicons.glyphMap;
}

/**
 * أزرار تنقل عائمة — على الجوال ومتصفح الجوال.
 * تُخفى فقط في تخطيط سطح المكتب الواسع (شريط جانبي).
 * أعلى العمود: أفاتار صاحب المحتوى (+ متابعة) أكبر من بقية الأزرار.
 */
function FloatingActionMenuComponent() {
  const { currentUser, fabIcons, users, toggleFollowUser } = useTournament();
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
  const [author, setAuthor] = useState<ContentAuthorFocus | null>(null);

  useEffect(() => subscribeContentAuthorFocus(setAuthor), []);

  useEffect(() => {
    if (isFloatingSuppressed()) {
      opacity.setValue(0);
      translateY.setValue(18);
      return;
    }
    forceFloatingVisible();
    opacity.setValue(1);
    translateY.setValue(0);
  }, [pathname, opacity, translateY]);

  useEffect(() => {
    if (Platform.OS === 'web' && !isFloatingSuppressed()) {
      forceFloatingVisible();
    }
  }, []);

  useEffect(() => {
    if (!visible || isFloatingSuppressed()) {
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.cubic),
          useNativeDriver,
        }),
        Animated.timing(translateY, {
          toValue: 18,
          duration: 120,
          easing: Easing.in(Easing.cubic),
          useNativeDriver,
        }),
      ]).start();
      return;
    }
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
  }, [opacity, translateY, visible]);

  const actions = useMemo(() => {
    if (!currentUser) return [];
    const active = currentUser.activeRole || currentUser.role;
    if (active === 'superadmin' || currentUser.role === 'superadmin') {
      return [];
    }

    const labelForHref = (href: string, fallback: string) => {
      if (href.includes('unique')) return t('menu.unique');
      if (href.includes('forums')) return t('menu.forums');
      if (href.includes('shares')) return t('menu.shares');
      if (href.includes('search')) return t('menu.search');
      return fallback;
    };

    const fromStore: FabIconConfig[] = Array.isArray(fabIcons) ? fabIcons : [];
    const mapped = fromStore
      .filter((a) => a.href && a.icon)
      .filter(
        (a) =>
          !a.href.includes('notifications') &&
          !a.id.toLowerCase().includes('notif')
      )
      .map((a) => ({
        key: a.id,
        label: labelForHref(a.href, a.label || a.href),
        icon: (isIoniconName(a.icon)
          ? a.icon
          : 'ellipse-outline') as keyof typeof Ionicons.glyphMap,
        href: a.href,
      }));

    if (active === 'organizer' || currentUser.role === 'organizer') {
      return mapped.filter((a) =>
        ['search', '/search'].some(
          (k) => a.key.includes(k) || a.href.includes(k)
        )
      );
    }
    return mapped;
  }, [currentUser, fabIcons, t]);

  const authorProfile = useMemo(() => {
    if (!author?.id) return null;
    const known = users.find((u) => u.id === author.id);
    return {
      id: author.id,
      name: known?.name || author.name,
      handle: known?.handle || author.handle,
      avatar: known?.avatar || author.avatar,
    };
  }, [author, users]);

  const isFollowingAuthor = useMemo(() => {
    if (!currentUser || !authorProfile) return false;
    const me = ensureSocialLists(currentUser);
    return (me.following || []).includes(authorProfile.id);
  }, [currentUser, authorProfile]);

  const onPrivateSpace =
    !!pathname &&
    (pathname.includes('/private') || pathname.includes('(follower)/private'));

  const showAuthor = !!authorProfile && authorProfile.id !== currentUser?.id;
  if (!currentUser || (actions.length === 0 && !showAuthor)) return null;
  if (desktop) return null;
  if (!visible || isFloatingSuppressed()) return null;
  if (onPrivateSpace) return null;
  if (
    pathname?.includes('(auth)') ||
    pathname?.includes('(console)') ||
    pathname?.includes('/admin') ||
    pathname === '/login'
  ) {
    return null;
  }

  const isActive = (href: string) =>
    pathname === href || pathname?.endsWith(href);

  const bottom = floatingAboveTabOffset(
    Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 0)
  );

  const openAuthorProfile = () => {
    if (!authorProfile) return;
    router.push(
      `/(follower)/profile/${authorProfile.id || authorProfile.handle}` as any
    );
  };

  const onToggleFollow = () => {
    if (!authorProfile) return;
    toggleFollowUser(authorProfile.id);
  };

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

        {showAuthor && authorProfile ? (
          <View style={[styles.item, styles.authorItem, styles.itemRaised]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                authorProfile.handle || authorProfile.name
              }
              onPress={openAuthorProfile}
              hitSlop={6}
              style={({ pressed }) => [
                styles.authorBtn,
                {
                  borderColor: theme.colors.accent,
                  backgroundColor: theme.colors.surfaceElevated,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Avatar
                uri={authorProfile.avatar}
                name={authorProfile.name}
                size={52}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isFollowingAuthor
                  ? t('account.stats.unfollow')
                  : t('account.stats.follow')
              }
              onPress={onToggleFollow}
              hitSlop={8}
              style={[
                styles.followBadge,
                {
                  backgroundColor: isFollowingAuthor
                    ? theme.colors.surfaceElevated
                    : theme.colors.accent,
                  borderColor: theme.colors.accent,
                },
              ]}
            >
              <Ionicons
                name={isFollowingAuthor ? 'checkmark' : 'add'}
                size={14}
                color={
                  isFollowingAuthor
                    ? theme.colors.accent
                    : theme.colors.textInverse
                }
              />
            </Pressable>
          </View>
        ) : null}
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
  authorItem: {
    width: 56,
    height: 56,
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
  authorBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  followBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
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

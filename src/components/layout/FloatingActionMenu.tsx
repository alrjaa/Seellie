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
import {
  forceFloatingVisible,
  isFloatingSuppressed,
  setFloatingSuppressed,
  subscribeFloatingVisibility,
} from '@/services/floating-scroll-bus';
import {
  setContentAuthorFocus,
  subscribeContentAuthorFocus,
  type ContentAuthorFocus,
} from '@/services/content-author-bus';
import { Avatar } from '@/components/ui';
import { cairoText } from '@/theme/fonts';
import { useResponsive } from '@/hooks/useResponsive';
import { ensureSocialLists } from '@/utils/social-stats';
import type { FabIconConfig } from '@/types/fab-icons';

function isHttpMedia(url?: string) {
  return !!url && /^https?:\/\//i.test(url.trim());
}

function normalizeHandle(handle?: string) {
  return (handle || '').replace(/^@/, '').trim().toLowerCase();
}

function pickAvatarUrl(
  ...candidates: Array<string | undefined | null>
): string | undefined {
  for (const raw of candidates) {
    const value = (raw || '').trim();
    if (!value) continue;
    if (
      /^https?:\/\//i.test(value) ||
      value.startsWith('data:') ||
      value.startsWith('blob:') ||
      value.startsWith('/')
    ) {
      return value;
    }
  }
  return undefined;
}

function isIoniconName(
  name: string
): name is keyof typeof Ionicons.glyphMap {
  return name in Ionicons.glyphMap;
}

/** تبويب الرئيسية للمتابع — الأفاتار هنا لصاحب الحساب لا لصاحب المحتوى */
function isFollowerHomePath(pathname?: string | null) {
  if (!pathname) return false;
  const p = pathname.replace(/\/+$/, '') || '/';
  return (
    p === '/' ||
    p === '/(follower)' ||
    p === '/(follower)/index' ||
    p.endsWith('/(follower)') ||
    p.endsWith('/(follower)/index')
  );
}

/**
 * أزرار تنقل عائمة — الجوال / متصفح الجوال.
 * أسفل العمود: أفاتار صاحب المحتوى الظاهر (يتغيّر مع التمرير) + متابعة.
 */
function FloatingActionMenuComponent() {
  const { currentUser, fabIcons, users, toggleFollowUser, competitions } =
    useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { desktop } = useResponsive();
  const [chromeVisible, setChromeVisible] = useState(true);
  const [suppressed, setSuppressed] = useState(() => isFloatingSuppressed());
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [author, setAuthor] = useState<ContentAuthorFocus | null>(null);

  useEffect(() => subscribeContentAuthorFocus(setAuthor), []);
  useEffect(
    () =>
      subscribeFloatingVisibility((next) => {
        setChromeVisible(next);
        setSuppressed(isFloatingSuppressed());
      }),
    []
  );

  // بذرة فقط إن لم يُحدَّد صاحب محتوى بعد — لا تستبدل صاحب المحتوى الظاهر
  useEffect(() => {
    if (author?.id) return;
    if (!competitions?.length) return;
    for (const comp of competitions) {
      const hasMedia =
        (comp.media?.photos || []).some((p) => isHttpMedia(p.url)) ||
        (comp.media?.videos || []).some((v) => isHttpMedia(v.url)) ||
        comp.teams.some((team) =>
          team.players.some(
            (p) =>
              (p.media?.photos || []).some((x) => isHttpMedia(x.url)) ||
              (p.media?.videos || []).some((x) => isHttpMedia(x.url))
          )
        ) ||
        (comp.matches || []).some(
          (m) =>
            (m.media?.photos || []).some((x) => isHttpMedia(x.url)) ||
            (m.media?.videos || []).some((x) => isHttpMedia(x.url))
        );
      if (!hasMedia || !comp.organizerId) continue;
      if (currentUser?.id && comp.organizerId === currentUser.id) continue;
      const organizer = users.find((u) => u.id === comp.organizerId);
      setContentAuthorFocus({
        id: comp.organizerId,
        name: organizer?.name || comp.name,
        handle: organizer?.handle,
        avatar: pickAvatarUrl(organizer?.avatar, comp.logo),
      });
      break;
    }
  }, [author?.id, competitions, users, currentUser?.id]);

  // مسار الخاصة يخفي العائمة؛ أي تبويب آخر يلغي الإخفاء فوراً
  // (تبويبات Expo تبقى مركّبة — لا نعتمد على unmount)
  // ملاحظة: شاشة الفريد تضغط setFloatingSuppressed أثناء نموذج النشر
  useEffect(() => {
    const onPrivate =
      !!pathname &&
      (pathname.includes('/private') ||
        pathname.includes('(follower)/private'));
    setFloatingSuppressed(onPrivate);
    setSuppressed(onPrivate);
    if (!onPrivate) {
      forceFloatingVisible();
    }
  }, [pathname]);

  const fabShown = chromeVisible && !suppressed;

  // أصلي فقط: Animated — الويب يعتمد CSS عبر View عادي
  useEffect(() => {
    if (Platform.OS === 'web') return;
    opacity.stopAnimation();
    translateY.stopAnimation();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: fabShown ? 1 : 0,
        duration: fabShown ? 220 : 160,
        easing: fabShown ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: fabShown ? 0 : 28,
        duration: fabShown ? 220 : 160,
        easing: fabShown ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fabShown, opacity, translateY]);

  const role = currentUser?.activeRole || currentUser?.role;
  const isFollowerLike =
    !!currentUser &&
    role !== 'superadmin' &&
    currentUser.role !== 'superadmin' &&
    role !== 'organizer' &&
    currentUser.role !== 'organizer';

  const actions = useMemo(() => {
    if (!currentUser) return [];
    if (role === 'superadmin' || currentUser.role === 'superadmin') {
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

    if (role === 'organizer' || currentUser.role === 'organizer') {
      return mapped.filter((a) =>
        ['search', '/search'].some(
          (k) => a.key.includes(k) || a.href.includes(k)
        )
      );
    }
    return mapped;
  }, [currentUser, fabIcons, role, t]);

  const authorProfile = useMemo(() => {
    if (!author?.id) return null;
    const handleKey = normalizeHandle(author.handle);
    const known =
      users.find((u) => u.id === author.id) ||
      (handleKey
        ? users.find((u) => normalizeHandle(u.handle) === handleKey)
        : undefined);
    const fromCompetition = competitions?.find(
      (c) => c.organizerId === author.id || c.organizerId === known?.id
    );
    return {
      id: author.id,
      name: author.name || known?.name || author.handle || author.id,
      handle: author.handle || known?.handle,
      avatar: pickAvatarUrl(
        author.avatar,
        known?.avatar,
        fromCompetition?.logo
      ),
      isSelf: !!(currentUser && author.id === currentUser.id),
    };
  }, [author, users, currentUser, competitions]);

  const onHome = isFollowerHomePath(pathname);

  /** الرئيسية → حسابي | اللقطات/عام/… → صاحب المحتوى الظاهر */
  const identityProfile = useMemo(() => {
    if (onHome && currentUser) {
      return {
        id: currentUser.id,
        name: currentUser.name,
        handle: currentUser.handle,
        avatar: pickAvatarUrl(currentUser.avatar),
        isSelf: true,
        mode: 'account' as const,
      };
    }
    if (!authorProfile) return null;
    return { ...authorProfile, mode: 'content' as const };
  }, [onHome, currentUser, authorProfile]);

  const isFollowingAuthor = useMemo(() => {
    if (!currentUser || !identityProfile || identityProfile.isSelf) return false;
    if (identityProfile.mode !== 'content') return false;
    const me = ensureSocialLists(currentUser);
    return (me.following || []).includes(identityProfile.id);
  }, [currentUser, identityProfile]);

  const onPrivateSpace =
    !!pathname &&
    (pathname.includes('/private') || pathname.includes('(follower)/private'));

  if (!currentUser) return null;
  if (!isFollowerLike && actions.length === 0) return null;
  if (desktop) return null;
  // عند الإخفاء القسري فقط (محادثة الخاصة…) — لا تُلغَ الواجهة عند التمرير
  if (suppressed) return null;
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

  const openIdentityProfile = () => {
    if (!identityProfile) {
      router.push('/(follower)/highlights' as any);
      return;
    }
    if (identityProfile.mode === 'account') {
      router.push('/(follower)/settings/account' as any);
      return;
    }
    router.push(
      `/(follower)/profile/${identityProfile.id || identityProfile.handle}` as any
    );
  };

  const onToggleFollow = () => {
    if (!identityProfile || identityProfile.mode !== 'content') return;
    toggleFollowUser(identityProfile.id);
  };

  const identityLabel = identityProfile
    ? identityProfile.handle || identityProfile.name
    : t('menu.contentAuthor');

  const motionStyle =
    Platform.OS === 'web'
      ? ({
          opacity: fabShown ? 1 : 0,
          transform: [{ translateY: fabShown ? 0 : 24 }],
          transitionProperty: 'opacity, transform',
          transitionDuration: fabShown ? '200ms' : '140ms',
          transitionTimingFunction: 'ease-out',
          willChange: 'opacity, transform',
        } as const)
      : {
          opacity,
          transform: [{ translateY }],
        };

  const Wrap = Platform.OS === 'web' ? View : Animated.View;

  return (
    <View
      pointerEvents="box-none"
      // @ts-expect-error RN web dataset
      dataSet={{ seellieFab: '1' }}
      style={[styles.layer, Platform.OS === 'web' && styles.layerWeb]}
    >
      <Wrap
        pointerEvents={fabShown ? 'box-none' : 'none'}
        style={[
          styles.wrap,
          Platform.OS === 'web' && styles.wrapWeb,
          {
            // ثابت فيزيائياً يسار الشاشة في العربية والإنجليزية —
            // لا left/right حسب isRTL (كان ينقل العمود يميناً مع RTL).
            left: Math.max(insets.left, 10),
            right: undefined,
            bottom,
            ...motionStyle,
          },
        ]}
      >
        {/* أسفل العمود: حسابي في الرئيسية · صاحب المحتوى في اللقطات/عام/… */}
        {isFollowerLike ? (
          <View style={[styles.authorItem, styles.itemRaised]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={identityLabel}
              onPress={openIdentityProfile}
              hitSlop={6}
              style={({ pressed }) => [
                styles.authorBtn,
                {
                  borderColor: identityProfile
                    ? theme.colors.accent
                    : theme.colors.border,
                  backgroundColor: theme.colors.surfaceElevated,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              {identityProfile ? (
                <Avatar
                  key={`fab-id-${identityProfile.mode}-${identityProfile.id}-${identityProfile.avatar || 'x'}`}
                  uri={identityProfile.avatar}
                  name={
                    identityProfile.name || identityProfile.handle || 'user'
                  }
                  size={54}
                />
              ) : (
                <Ionicons
                  name="person-circle-outline"
                  size={40}
                  color={theme.colors.textMuted}
                />
              )}
            </Pressable>
            {identityProfile &&
            identityProfile.mode === 'content' &&
            !identityProfile.isSelf ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isFollowingAuthor
                    ? t('account.stats.unfollow')
                    : t('account.stats.follow')
                }
                onPress={onToggleFollow}
                hitSlop={10}
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
                  size={16}
                  color={
                    isFollowingAuthor
                      ? theme.colors.accent
                      : theme.colors.textInverse
                  }
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}

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
      </Wrap>
    </View>
  );
}

export const FloatingActionMenu = memo(FloatingActionMenuComponent);

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,

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
    // عزل عن RTL الأب حتى تبقى left = يسار الشاشة فعلياً
    direction: 'ltr',
    // العمود من الأسفل للأعلى: العنصر الأول في القمة
    flexDirection: 'column-reverse',
    gap: 12,
    // محاذاة مركزية على خط واحد رغم اختلاف أحجام الأزرار
    alignItems: 'center',

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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  authorItem: {
    position: 'relative',
    width: 58,
    height: 58,
    alignItems: 'center',
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
  authorBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  followBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
    elevation: 12,
  },
  tooltip: {
    position: 'absolute',
    left: 54,
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

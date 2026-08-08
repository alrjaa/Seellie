import React, { memo, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation, useLanguage } from '@/providers/LanguageProvider';
import { useResponsive } from '@/hooks/useResponsive';
import { cairoText } from '@/theme/fonts';
import { DEFAULT_LOGO_MODULE } from '@/theme/brand';
import { Image } from 'expo-image';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AccountMenuButton } from '@/components/layout/AccountMenuButton';

export type DesktopNavItem = {
  key: string;
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  section?: string;
};

type Props = {
  children: ReactNode;
  items: DesktopNavItem[];
  accountHref: string;
  settingsHref?: string;
  brandLabel?: string;
};

function pathMatches(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  const cleanHref = href.replace(/\/index$/, '').replace(/\/$/, '');
  const cleanPath = pathname.replace(/\/$/, '');
  if (cleanPath === cleanHref) return true;
  if (cleanHref && cleanPath.startsWith(cleanHref + '/')) return true;
  // expo-router web paths often drop group segments
  const hrefTail = cleanHref.split('/').filter(Boolean).pop();
  const pathTail = cleanPath.split('/').filter(Boolean).pop();
  if (hrefTail && pathTail && hrefTail === pathTail && hrefTail !== '(follower)') {
    return cleanPath.includes(hrefTail);
  }
  return false;
}

function DesktopShellComponent({
  children,
  items,
  accountHref,
  settingsHref,
  brandLabel,
}: Props) {
  const theme = useAppTheme();
  const { appName } = useTournament();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarWidth, desktop } = useResponsive();

  if (!desktop) {
    return <>{children}</>;
  }

  const sections = items.reduce<Record<string, DesktopNavItem[]>>((acc, item) => {
    const key = item.section || 'main';
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  const textAlign = isRTL ? 'right' : 'left';
  const writingDirection = isRTL ? 'rtl' : 'ltr';

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.isDark ? '#071018' : '#E8EEF3',
          direction: isRTL ? 'rtl' : 'ltr',
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.ambient,
          {
            backgroundColor: theme.isDark
              ? 'rgba(37,244,238,0.05)'
              : 'rgba(13,26,38,0.04)',
          },
        ]}
      />

      <View
        style={[
          styles.shell,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
            shadowColor: '#000',
          },
        ]}
      >
        <View
          style={[
            styles.sidebar,
            {
              width: sidebarWidth,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderLeftWidth: isRTL ? StyleSheet.hairlineWidth : 0,
              borderRightWidth: isRTL ? 0 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          <View
            style={[
              styles.brandRow,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <Image
              source={DEFAULT_LOGO_MODULE}
              style={styles.brandLogo}
              contentFit="contain"
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[
                  styles.brandName,
                  cairoText('extraBold'),
                  {
                    color: theme.colors.accent,
                    textAlign,
                    writingDirection,
                  },
                ]}
                numberOfLines={1}
              >
                {brandLabel || appName || 'Seellie'}
              </Text>
              <Text
                style={[
                  styles.brandSub,
                  cairoText('medium'),
                  {
                    color: theme.colors.textMuted,
                    textAlign,
                    writingDirection,
                  },
                ]}
                numberOfLines={1}
              >
                {t('auth.tagline')}
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.navScroll}
            showsVerticalScrollIndicator={false}
          >
            {Object.entries(sections).map(([section, sectionItems]) => (
              <View key={section} style={styles.section}>
                {section !== 'main' ? (
                  <Text
                    style={[
                      styles.sectionLabel,
                      cairoText('semiBold'),
                      {
                        color: theme.colors.textMuted,
                        textAlign,
                        writingDirection,
                      },
                    ]}
                  >
                    {section}
                  </Text>
                ) : null}
                {sectionItems.map((item) => {
                  const active = pathMatches(pathname, item.href);
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => router.push(item.href as any)}
                      style={({ pressed }) => [
                        styles.navItem,
                        {
                          backgroundColor: active
                            ? theme.colors.accentSoft
                            : pressed
                              ? theme.colors.primarySoft
                              : 'transparent',
                          borderColor: active
                            ? theme.colors.accent
                            : 'transparent',
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={
                          active ? theme.colors.accent : theme.colors.textMuted
                        }
                      />
                      <Text
                        style={[
                          styles.navLabel,
                          cairoText(active ? 'bold' : 'semiBold'),
                          {
                            color: active
                              ? theme.colors.accent
                              : theme.colors.text,
                            textAlign,
                            writingDirection,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View
            style={[
              styles.sidebarFooter,
              { borderTopColor: theme.colors.border },
            ]}
          >
            <ThemeToggle />
            <AccountMenuButton
              accountHref={accountHref}
              settingsHref={settingsHref}
              variant="handle"
              compact
            />
          </View>
        </View>

        <View style={styles.main}>{children}</View>
      </View>
    </View>
  );
}

export const DesktopShell = memo(DesktopShellComponent);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 18,
  },
  ambient: {
    ...StyleSheet.absoluteFillObject,
  },
  shell: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  sidebar: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  brandLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  brandName: {
    fontSize: 16,
    letterSpacing: 0.3,
  },
  brandSub: {
    fontSize: 11,
    marginTop: 2,
  },
  navScroll: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 4,
  },
  section: {
    gap: 4,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navItem: {
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  navLabel: {
    flex: 1,
    fontSize: 13,
  },
  sidebarFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
    alignItems: 'stretch',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
});

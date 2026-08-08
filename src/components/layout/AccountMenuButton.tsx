import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { headerSafeTop } from '@/theme/navigation';
import {
  getSecondaryRole,
  normalizeUserRoles,
} from '@/utils/roles';
import type { UserRole } from '@/types';
import { cairoText } from '@/theme/fonts';

type Props = {
  accountHref: string;
  /** إعدادات الحساب (فيها بطاقة مسارات الحساب). إن لم تُمرَّر تُستنتج من الدور النشط */
  settingsHref?: string;
  /** avatar = صورة (للهيدر الثانوي) · handle = @المعرّف فقط */
  variant?: 'avatar' | 'handle';
  size?: number;
  emphasized?: boolean;
  /** أصغر للأشرطة الضيقة (مثل شاشة عام) */
  compact?: boolean;
};

function defaultSettingsHref(
  activeRole: string | undefined,
  accountHref: string
): string {
  switch (activeRole) {
    case 'organizer':
      return '/(organizer)/settings';
    case 'freelancer':
      return '/(freelancer)/settings';
    case 'follower':
      return '/(follower)/settings';
    case 'superadmin':
      return '/(superadmin)/settings';
    default:
      return accountHref;
  }
}

/**
 * قائمة الحساب المنسدلة: مسارات الحساب + دخول المشرف + إعدادات + خروج.
 */
function AccountMenuButtonComponent({
  accountHref,
  settingsHref,
  variant = 'avatar',
  size = 32,
  compact,
}: Props) {
  const { currentUser, logout, switchActiveRole } = useTournament();
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const rowDir = isRTL ? ('row-reverse' as const) : ('row' as const);
  const textStart = {
    textAlign: (isRTL ? 'right' : 'left') as 'left' | 'right',
    writingDirection: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
  };
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const pathsHref = useMemo(() => {
    if (settingsHref) return settingsHref;
    return defaultSettingsHref(
      currentUser?.activeRole || currentUser?.role,
      accountHref
    );
  }, [settingsHref, currentUser, accountHref]);

  const roleSwitch = useMemo(() => {
    if (!currentUser || currentUser.role === 'superadmin') return null;
    const normalized = normalizeUserRoles(currentUser);
    const secondary = getSecondaryRole(normalized.roles);
    if (!secondary) return null;
    const active: UserRole = normalized.activeRole || normalized.role;
    return { secondary, active, roles: normalized.roles };
  }, [currentUser]);

  const close = useCallback(() => setOpen(false), []);

  const goPaths = useCallback(() => {
    setOpen(false);
    router.push(pathsHref as any);
  }, [pathsHref, router]);

  const goAccount = useCallback(() => {
    setOpen(false);
    router.push(accountHref as any);
  }, [accountHref, router]);

  const onLogout = useCallback(() => {
    setOpen(false);
    logout();
  }, [logout]);

  const onEnterAdmin = useCallback(() => {
    setOpen(false);
    logout({ to: 'admin' });
  }, [logout]);

  const onSwitchRole = useCallback(
    (role: UserRole) => {
      setOpen(false);
      switchActiveRole(role);
    },
    [switchActiveRole]
  );

  if (!currentUser) return null;

  const isSuperAdmin = currentUser.role === 'superadmin';
  const sameHref = pathsHref === accountHref;
  const roleLabel = (role: UserRole) => t(`roles.${role}`);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('menu.accountMenu')}
        accessibilityHint={
          isSuperAdmin ? t('menu.accountSettings') : t('menu.accountMenuHint')
        }
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [
          variant === 'handle' ? styles.handleWrap : styles.wrap,
          variant === 'handle' && compact && styles.handleWrapCompact,
          variant === 'handle' && {
            borderColor: theme.colors.accent,
            backgroundColor: theme.colors.accentSoft,
            flexDirection: rowDir,
          },
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        {variant === 'handle' ? (
          <Text
            style={[
              styles.handleLabel,
              compact && styles.handleLabelCompact,
              cairoText('semiBold'),
              { color: theme.colors.accent },
              textStart,
            ]}
            numberOfLines={1}
          >
            {currentUser.handle}
          </Text>
        ) : (
          <View
            style={[
              styles.avatarFallback,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: theme.colors.accentSoft,
              },
            ]}
          >
            <Ionicons
              name="person"
              size={Math.round(size * 0.5)}
              color={theme.colors.accent}
            />
          </View>
        )}
        {variant === 'avatar' ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.accent,
                borderColor: theme.colors.surface,
              },
            ]}
          >
            <Ionicons
              name="chevron-down"
              size={9}
              color={theme.colors.textInverse}
            />
          </View>
        ) : (
          <Ionicons
            name="chevron-down"
            size={compact ? 10 : 12}
            color={theme.colors.accent}
          />
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t('menu.closeMenu')}
          />
          <View
            style={[
              styles.menu,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                marginTop: headerSafeTop(insets.top),
                direction: isRTL ? 'rtl' : 'ltr',
              },
            ]}
          >
            <View
              style={[
                styles.menuHeader,
                { alignItems: isRTL ? 'flex-end' : 'flex-start' },
              ]}
            >
              <Text
                style={[
                  styles.menuHandle,
                  cairoText('extraBold'),
                  { color: theme.colors.accent },
                  textStart,
                ]}
                numberOfLines={1}
              >
                {currentUser.handle}
              </Text>
              <Text
                style={[styles.menuReg, { color: theme.colors.textMuted }, textStart]}
                numberOfLines={1}
              >
                {currentUser.visibleId}
              </Text>
            </View>

            <View
              style={[styles.divider, { backgroundColor: theme.colors.border }]}
            />

            <ScrollView
              style={styles.menuScroll}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              {!isSuperAdmin ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('menu.enterAdmin')}
                  onPress={onEnterAdmin}
                  style={({ pressed }) => [
                    styles.item,
                    styles.itemHighlight,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.accent,
                      opacity: pressed ? 0.85 : 1,
                      flexDirection: rowDir,
                    },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color={theme.colors.accent}
                  />
                  <Text
                    style={[
                      styles.itemLabel,
                      { color: theme.colors.accent },
                      textStart,
                    ]}
                  >
                    {t('menu.enterAdmin')}
                  </Text>
                </Pressable>
              ) : null}

              {!isSuperAdmin ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('menu.accountPaths')}
                  onPress={goPaths}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: pressed
                        ? theme.colors.accentSoft
                        : 'transparent',
                      flexDirection: rowDir,
                    },
                  ]}
                >
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={20}
                    color={theme.colors.accent}
                  />
                  <Text
                    style={[styles.itemLabel, { color: theme.colors.text }, textStart]}
                  >
                    {t('menu.accountPaths')}
                  </Text>
                </Pressable>
              ) : null}

              {roleSwitch ? (
                <>
                  {roleSwitch.roles.includes('follower') &&
                  roleSwitch.active !== 'follower' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('menu.enterFollower')}
                      onPress={() => onSwitchRole('follower')}
                      style={({ pressed }) => [
                        styles.item,
                        {
                          backgroundColor: pressed
                            ? theme.colors.accentSoft
                            : 'transparent',
                          flexDirection: rowDir,
                        },
                      ]}
                    >
                      <Ionicons
                        name="people-outline"
                        size={20}
                        color={theme.colors.accent}
                      />
                      <Text
                        style={[
                          styles.itemLabel,
                          { color: theme.colors.accent },
                          textStart,
                        ]}
                      >
                        {t('menu.enterFollower')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {roleSwitch.active !== roleSwitch.secondary ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('menu.enterRole', {
                        role: roleLabel(roleSwitch.secondary),
                      })}
                      onPress={() => onSwitchRole(roleSwitch.secondary)}
                      style={({ pressed }) => [
                        styles.item,
                        styles.itemHighlight,
                        {
                          backgroundColor: theme.colors.accentSoft,
                          borderColor: theme.colors.accent,
                          opacity: pressed ? 0.85 : 1,
                          flexDirection: rowDir,
                        },
                      ]}
                    >
                      <Ionicons
                        name="briefcase-outline"
                        size={20}
                        color={theme.colors.accent}
                      />
                      <Text
                        style={[
                          styles.itemLabel,
                          { color: theme.colors.accent },
                          textStart,
                        ]}
                      >
                        {t('menu.enterRole', {
                          role: roleLabel(roleSwitch.secondary),
                        })}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('menu.accountSettings')}
                onPress={sameHref || isSuperAdmin ? goPaths : goAccount}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: pressed
                      ? theme.colors.accentSoft
                      : 'transparent',
                    flexDirection: rowDir,
                  },
                ]}
              >
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={theme.colors.accent}
                />
                <Text
                  style={[styles.itemLabel, { color: theme.colors.text }, textStart]}
                >
                  {t('menu.accountSettings')}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('menu.exit')}
                onPress={onLogout}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: pressed
                      ? theme.colors.dangerSoft
                      : 'transparent',
                    flexDirection: rowDir,
                  },
                ]}
              >
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={theme.colors.danger}
                />
                <Text
                  style={[styles.itemLabel, { color: theme.colors.danger }, textStart]}
                >
                  {t('menu.exit')}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export const AccountMenuButton = memo(AccountMenuButtonComponent);

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    position: 'relative',
  },
  handleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingHorizontal: Platform.OS === 'android' ? 6 : 10,
    paddingVertical: Platform.OS === 'android' ? 3 : 6,
    borderRadius: Platform.OS === 'android' ? 7 : 10,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: Platform.OS === 'android' ? 96 : 160,
    alignSelf: 'flex-end',
  },
  handleWrapCompact: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: Platform.OS === 'android' ? 88 : 110,
  },
  handleLabel: {
    fontSize: Platform.OS === 'android' ? 9 : 11,
  },
  handleLabelCompact: {
    fontSize: Platform.OS === 'android' ? 8 : 9,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  menu: {
    width: '88%',
    maxWidth: 340,
    maxHeight: '78%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  menuScroll: {
    maxHeight: 420,
  },
  menuHeader: {
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuHandle: {
    fontSize: 16,
    width: '100%',
  },
  menuReg: {
    fontWeight: '600',
    fontSize: 11,
    width: '100%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    marginHorizontal: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  itemHighlight: {
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
});

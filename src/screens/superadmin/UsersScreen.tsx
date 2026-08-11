import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTournament, type User } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, Chip, Muted, SearchBar, Subtitle } from '@/components/ui';
import { statusToneColor } from '@/utils/status-tone';
import { matchesSearchQuery } from '@/utils/search';
import { isSupabaseConfigured } from '@/services/supabase';
import { confirmDestructive } from '@/utils/confirm';

function matchesUserQuery(user: User, rawQuery: string): boolean {
  return matchesSearchQuery(
    rawQuery,
    user.name,
    user.email,
    user.handle,
    user.visibleId,
    user.mobile,
    user.id
  );
}

const UserRow = memo(function UserRow({
  user,
  onAction,
  onEdit,
}: {
  user: User;
  onAction: (
    user: User,
    action: 'active' | 'suspended' | 'warned' | 'delete'
  ) => void;
  onEdit?: (user: User) => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const statusColor = statusToneColor(theme.colors, user.status);
  const isBlocked = user.status === 'blocked';

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={user.avatar} name={user.name} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {user.name}
          </Text>
          <Muted>{user.handle}</Muted>
          <Muted>{t('superadmin.users.regIdLine', { id: user.visibleId })}</Muted>
          <Muted>{user.email}</Muted>
          {user.mobile ? <Muted>{user.mobile}</Muted> : null}
          <View style={styles.badges}>
            <Text style={[styles.badge, { color: theme.colors.textMuted }]}>
              {t(`roles.${user.role}`)}
            </Text>
            <Text style={[styles.badge, { color: statusColor }]}>
              {t(`status.${user.status}`)}
            </Text>
          </View>
        </View>
      </View>
      {user.role !== 'superadmin' ? (
        <View style={styles.actions}>
          {isBlocked ? (
            <Pressable onPress={() => onAction(user, 'delete')}>
              <Text
                style={{
                  color: theme.colors.danger,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                حذف نهائي من Auth
              </Text>
            </Pressable>
          ) : (
            <>
              {user.role === 'organizer' && onEdit ? (
                <Pressable onPress={() => onEdit(user)}>
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {t('superadmin.actions.edit')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => onAction(user, 'active')}>
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {t('superadmin.actions.activate')}
                </Text>
              </Pressable>
              <Pressable onPress={() => onAction(user, 'warned')}>
                <Text
                  style={{
                    color: theme.colors.warning,
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {t('superadmin.actions.warn')}
                </Text>
              </Pressable>
              <Pressable onPress={() => onAction(user, 'suspended')}>
                <Text
                  style={{
                    color: theme.colors.danger,
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {t('superadmin.actions.suspend')}
                </Text>
              </Pressable>
              <Pressable onPress={() => onAction(user, 'delete')}>
                <Text
                  style={{
                    color: theme.colors.danger,
                    fontWeight: '800',
                    fontSize: 12,
                  }}
                >
                  حذف نهائي
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </Card>
  );
});

export default function UsersScreen() {
  const { users, updateUser, deleteUser, purgeUserByEmail, syncCloudUsers } =
    useTournament();
  const router = useRouter();
  const { t } = useTranslation();
  const { toast } = useToast();
  const theme = useAppTheme();
  const [filter, setFilter] = useState<'all' | 'blocked' | User['role']>('all');
  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [purgeEmail, setPurgeEmail] = useState('');
  const [purging, setPurging] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured()) return;
      void syncCloudUsers();
    }, [syncCloudUsers])
  );

  const onSync = useCallback(async () => {
    setSyncing(true);
    try {
      const count = await syncCloudUsers();
      toast({
        variant: 'success',
        title: 'تمت المزامنة',
        description:
          count > 0
            ? `تم جلب ${count} حساباً من السحابة.`
            : 'لا توجد صفوف جديدة في profiles.',
      });
    } finally {
      setSyncing(false);
    }
  }, [syncCloudUsers, toast]);

  const data = useMemo(
    () =>
      users.filter((u) => {
        if (filter === 'blocked') return u.status === 'blocked';
        if (u.status === 'blocked') return false;
        if (filter !== 'all' && u.role !== filter) return false;
        return matchesUserQuery(u, query);
      }),
    [users, filter, query]
  );

  const blockedCount = useMemo(
    () => users.filter((u) => u.status === 'blocked').length,
    [users]
  );

  const onAction = useCallback(
    async (user: User, action: 'active' | 'suspended' | 'warned' | 'delete') => {
      if (action === 'delete') {
        const ok = await confirmDestructive({
          title: 'حذف نهائي',
          message: `سيتم حذف ${user.name} (${user.email}) من Authentication بالكامل حتى يمكن التسجيل بنفس البريد لاحقاً.`,
          cancelLabel: 'إلغاء',
          confirmLabel: 'تأكيد',
        });
        if (!ok) return;
        await deleteUser(user.id, `تم حذف ${user.name} نهائياً.`);
        return;
      }
      const messages = {
        active: t('superadmin.users.activated', { name: user.name }),
        suspended: t('superadmin.users.suspended', { name: user.name }),
        warned: t('superadmin.users.warned', { name: user.name }),
      };
      updateUser({ ...user, status: action }, messages[action]);
    },
    [updateUser, deleteUser, t]
  );

  const onPurgeEmail = useCallback(async () => {
    if (purging) return;
    const ok = await confirmDestructive({
      title: 'تحرير بريد للتسجيل',
      message: `حذف نهائي لكل حساب مرتبط بـ ${purgeEmail.trim()} من Authentication؟`,
      cancelLabel: 'إلغاء',
      confirmLabel: 'تأكيد',
    });
    if (!ok) return;
    setPurging(true);
    try {
      await purgeUserByEmail(purgeEmail);
      setPurgeEmail('');
    } finally {
      setPurging(false);
    }
  }, [purgeEmail, purgeUserByEmail, purging]);

  const emptyTitle = query.trim()
    ? t('superadmin.users.noSearchResults')
    : t('superadmin.users.empty');

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 8 }}>
            <Subtitle>{t('nav.users')}</Subtitle>
            <Muted>
              حذف نهائي = إزالة من Authentication. بعد الحذف يمكن إنشاء حساب جديد
              بنفس البريد.
            </Muted>
            {isSupabaseConfigured() ? (
              <Pressable
                onPress={() => void onSync()}
                disabled={syncing}
                style={styles.syncBtn}
              >
                <Text style={{ color: theme.colors.accent, fontWeight: '800' }}>
                  {syncing ? 'جاري المزامنة…' : 'مزامنة من السحابة'}
                </Text>
              </Pressable>
            ) : null}

            {isSupabaseConfigured() ? (
              <Card style={{ gap: 8 }}>
                <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                  تحرير بريد عالق
                </Text>
                <Muted>
                  إذا ظهر «البريد موجود» عند التسجيل: الصق الإيميل هنا واضغط تحرير.
                </Muted>
                <TextInput
                  value={purgeEmail}
                  onChangeText={setPurgeEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[
                    styles.emailInput,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceElevated,
                    },
                  ]}
                />
                <Pressable
                  onPress={() => void onPurgeEmail()}
                  disabled={purging || !purgeEmail.trim()}
                  style={[
                    styles.purgeBtn,
                    {
                      backgroundColor: theme.colors.danger,
                      opacity: purging || !purgeEmail.trim() ? 0.45 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {purging ? 'جاري التحرير…' : 'حذف نهائي وتحرير البريد'}
                  </Text>
                </Pressable>
              </Card>
            ) : null}

            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={t('superadmin.searchPlaceholder')}
            />
            <View style={styles.filters}>
              {(
                [
                  'all',
                  'blocked',
                  'follower',
                  'organizer',
                  'freelancer',
                ] as const
              ).map((key) => (
                <Chip
                  key={key}
                  label={
                    key === 'all'
                      ? t('common.all')
                      : key === 'blocked'
                        ? `محظور/عالق${blockedCount ? ` (${blockedCount})` : ''}`
                        : t(`roles.${key}`)
                  }
                  active={filter === key}
                  onPress={() => setFilter(key)}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState title={emptyTitle} icon="people-outline" />}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onAction={(u, a) => void onAction(u, a)}
            onEdit={
              item.role === 'organizer'
                ? (u) =>
                    router.push(`/admin/organizers/${u.id}` as any)
                : undefined
            }
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { gap: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  name: { fontWeight: '800', fontSize: 16 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  badge: { fontSize: 12, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  syncBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  emailInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  purgeBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
});

import React, { memo, useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament, type User } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, Chip, Muted, Subtitle } from '@/components/ui';

const UserRow = memo(function UserRow({
  user,
  onAction,
  onEdit,
}: {
  user: User;
  onAction: (user: User, action: 'active' | 'suspended' | 'warned' | 'delete') => void;
  onEdit?: (user: User) => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const statusColor =
    user.status === 'active'
      ? theme.colors.primary
      : user.status === 'suspended'
        ? theme.colors.danger
        : theme.colors.warning;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={user.avatar} name={user.name} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>{user.name}</Text>
          <Muted>{user.handle}</Muted>
          <Muted>{t('superadmin.users.regIdLine', { id: user.visibleId })}</Muted>
          <Muted>{user.email}</Muted>
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
          {user.role === 'organizer' && onEdit ? (
            <Pressable onPress={() => onEdit(user)}>
              <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 12 }}>
                {t('superadmin.actions.edit')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => onAction(user, 'active')}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>
              {t('superadmin.actions.activate')}
            </Text>
          </Pressable>
          <Pressable onPress={() => onAction(user, 'warned')}>
            <Text style={{ color: theme.colors.warning, fontWeight: '700', fontSize: 12 }}>
              {t('superadmin.actions.warn')}
            </Text>
          </Pressable>
          <Pressable onPress={() => onAction(user, 'suspended')}>
            <Text style={{ color: theme.colors.danger, fontWeight: '700', fontSize: 12 }}>
              {t('superadmin.actions.suspend')}
            </Text>
          </Pressable>
          <Pressable onPress={() => onAction(user, 'delete')}>
            <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 12 }}>
              {t('superadmin.actions.delete')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
});

export default function UsersScreen() {
  const { users, updateUser, deleteUser } = useTournament();
  const router = useRouter();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | User['role']>('all');

  const data = useMemo(
    () =>
      users.filter((u) => (filter === 'all' ? true : u.role === filter)),
    [users, filter]
  );

  const onAction = useCallback(
    (user: User, action: 'active' | 'suspended' | 'warned' | 'delete') => {
      if (action === 'delete') {
        Alert.alert(
          t('superadmin.actions.confirmDelete'),
          t('superadmin.users.deleteConfirm', { name: user.name }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('superadmin.actions.delete'),
              style: 'destructive',
              onPress: () =>
                deleteUser(
                  user.id,
                  t('superadmin.users.deleted', { name: user.name })
                ),
            },
          ]
        );
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

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 8 }}>
            <Subtitle>{t('nav.users')}</Subtitle>
            <Muted>{t('superadmin.users.subtitle')}</Muted>
            <View style={styles.filters}>
              {(
                [
                  ['all', t('screens.all')],
                  ['organizer', t('roles.organizer')],
                  ['follower', t('roles.follower')],
                  ['freelancer', t('roles.freelancer')],
                ] as const
              ).map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  active={filter === value}
                  onPress={() => setFilter(value)}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title={t('superadmin.users.empty')} icon="people-outline" />
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onAction={onAction}
            onEdit={(u) =>
              router.push(`/(superadmin)/organizers/${u.id}` as any)
            }
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  name: { fontWeight: '800', textAlign: 'left' },
  badges: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  badge: { fontSize: 11, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    flexWrap: 'wrap',
  },
  filters: { flexDirection: 'row', gap: 8 },
});

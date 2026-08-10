import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTournament, type Referee } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { EntityAvatarEditModal } from '@/components/account/EntityAvatarField';
import { Avatar, Button, Card, Muted, SearchBar, Subtitle } from '@/components/ui';
import { matchesSearchQuery } from '@/utils/search';
import { confirmDestructive } from '@/utils/confirm';
import { normalizeRefereeName } from '@/utils/referee-name';

const RefereeRow = memo(function RefereeRow({
  item,
  duplicateCount,
  onToggle,
  onDelete,
  onChangePhoto,
}: {
  item: Referee;
  duplicateCount: number;
  onToggle: () => void;
  onDelete: () => void;
  onChangePhoto: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const statusLabel =
    item.status === 'active'
      ? t('status.active')
      : item.status === 'suspended'
        ? t('status.suspended')
        : t('status.warned');

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={item.avatar} name={item.name} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>{item.name}</Text>
          {duplicateCount > 1 ? (
            <Muted style={{ color: theme.colors.danger }}>
              {t('superadmin.referees.duplicateBadge', { count: duplicateCount })}
            </Muted>
          ) : null}
          <Muted>
            {t('superadmin.referees.ratingLine', { rating: item.rating })}
          </Muted>
          <Muted>
            {t('superadmin.referees.statusLine', { status: statusLabel })}
          </Muted>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onChangePhoto} hitSlop={8}>
          <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 12 }}>
            {t('media.changeHandleIcon')}
          </Text>
        </Pressable>
        <Pressable onPress={onToggle} hitSlop={8}>
          <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 12 }}>
            {item.status === 'active'
              ? t('superadmin.actions.suspend')
              : t('superadmin.actions.activate')}
          </Text>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 12 }}>
            {t('superadmin.actions.delete')}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
});

export default function RefereesScreen() {
  const { referees, updateReferee, deleteReferee, dedupeRefereesByName } =
    useTournament();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [avatarEdit, setAvatarEdit] = useState<{
    id: string;
    name: string;
    value?: string;
  } | null>(null);

  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ref of referees) {
      const key = normalizeRefereeName(ref.name);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [referees]);

  const duplicateTotal = useMemo(() => {
    let extra = 0;
    for (const count of duplicateCounts.values()) {
      if (count > 1) extra += count - 1;
    }
    return extra;
  }, [duplicateCounts]);

  const data = useMemo(
    () =>
      referees.filter((item) =>
        matchesSearchQuery(query, item.name, item.id, item.status, item.rating)
      ),
    [referees, query]
  );

  const renderItem = useCallback(
    ({ item }: { item: Referee }) => (
      <RefereeRow
        item={item}
        duplicateCount={
          duplicateCounts.get(normalizeRefereeName(item.name)) || 1
        }
        onChangePhoto={() =>
          setAvatarEdit({
            id: item.id,
            name: item.name,
            value: item.avatar,
          })
        }
        onToggle={() =>
          updateReferee(
            {
              ...item,
              status: item.status === 'active' ? 'suspended' : 'active',
            },
            t('superadmin.referees.statusUpdated', { name: item.name })
          )
        }
        onDelete={() => {
          void (async () => {
            const ok = await confirmDestructive({
              title: t('common.confirm'),
              message: t('superadmin.referees.deleteConfirm', {
                name: item.name,
              }),
              cancelLabel: t('common.cancel'),
              confirmLabel: t('superadmin.actions.delete'),
            });
            if (!ok) return;
            deleteReferee(
              item.id,
              t('superadmin.referees.deleted', { name: item.name })
            );
          })();
        }}
      />
    ),
    [updateReferee, deleteReferee, t, duplicateCounts]
  );

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.modules.referees.title')}</Subtitle>
            <Muted>{t('superadmin.referees.subtitle')}</Muted>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={t('superadmin.searchPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {duplicateTotal > 0 ? (
              <Button
                label={t('superadmin.referees.removeDuplicates')}
                variant="danger"
                onPress={() => {
                  void (async () => {
                    const ok = await confirmDestructive({
                      title: t('common.confirm'),
                      message: t('superadmin.referees.removeDuplicatesConfirm'),
                      cancelLabel: t('common.cancel'),
                      confirmLabel: t('superadmin.referees.removeDuplicates'),
                    });
                    if (!ok) return;
                    dedupeRefereesByName();
                  })();
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              query.trim()
                ? t('superadmin.noSearchResults')
                : t('superadmin.referees.empty')
            }
            icon="person-outline"
          />
        }
        renderItem={renderItem}
      />
      {avatarEdit ? (
        <EntityAvatarEditModal
          visible
          title={`${t('media.changeHandleIcon')} — ${avatarEdit.name}`}
          value={avatarEdit.value}
          name={avatarEdit.name}
          folder="referees"
          onChange={(url) => {
            const current = referees.find((r) => r.id === avatarEdit.id);
            if (current) {
              updateReferee(
                { ...current, avatar: url },
                t('media.entityPhotoUpdated')
              );
            }
            setAvatarEdit((prev) =>
              prev ? { ...prev, value: url } : prev
            );
          }}
          onClose={() => setAvatarEdit(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  name: { fontWeight: '800', textAlign: 'left' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
});

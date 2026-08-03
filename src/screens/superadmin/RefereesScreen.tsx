import React, { memo, useCallback } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTournament, type Referee } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, Muted, Subtitle } from '@/components/ui';

const RefereeRow = memo(function RefereeRow({
  item,
  onToggle,
  onDelete,
}: {
  item: Referee;
  onToggle: () => void;
  onDelete: () => void;
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
          <Muted>
            {t('superadmin.referees.ratingLine', { rating: item.rating })}
          </Muted>
          <Muted>
            {t('superadmin.referees.statusLine', { status: statusLabel })}
          </Muted>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onToggle}>
          <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>
            {item.status === 'active'
              ? t('superadmin.actions.suspend')
              : t('superadmin.actions.activate')}
          </Text>
        </Pressable>
        <Pressable onPress={onDelete}>
          <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 12 }}>
            {t('superadmin.actions.delete')}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
});

export default function RefereesScreen() {
  const { referees, updateReferee, deleteReferee } = useTournament();
  const { t } = useTranslation();

  const renderItem = useCallback(
    ({ item }: { item: Referee }) => (
      <RefereeRow
        item={item}
        onToggle={() =>
          updateReferee(
            {
              ...item,
              status: item.status === 'active' ? 'suspended' : 'active',
            },
            t('superadmin.referees.statusUpdated', { name: item.name })
          )
        }
        onDelete={() =>
          Alert.alert(t('common.confirm'), t('superadmin.referees.deleteConfirm', { name: item.name }), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('superadmin.actions.delete'),
              style: 'destructive',
              onPress: () =>
                deleteReferee(item.id, t('superadmin.referees.deleted', { name: item.name })),
            },
          ])
        }
      />
    ),
    [updateReferee, deleteReferee, t]
  );

  return (
    <Screen>
      <FlatList
        data={referees}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.modules.referees.title')}</Subtitle>
            <Muted>{t('superadmin.referees.subtitle')}</Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title={t('superadmin.referees.empty')} icon="person-outline" />
        }
        renderItem={renderItem}
      />
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

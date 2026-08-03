import React, { memo, useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useTournament, type CompetitionRequest } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, Input, Muted, Subtitle } from '@/components/ui';
import { formatArabicDate } from '@/utils';
import { MIN_COMPETITION_TEAMS } from '@/utils/competition-request';
import { useAppTheme } from '@/providers/ThemeProvider';

const RequestCard = memo(function RequestCard({
  item,
  organizerName,
  onApprove,
  onReject,
}: {
  item: CompetitionRequest;
  organizerName: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const pending = item.status === 'pending';
  const statusColor =
    item.status === 'approved'
      ? theme.colors.primary
      : item.status === 'rejected'
        ? theme.colors.danger
        : theme.colors.warning;
  const pledgeMark = (ok: boolean) => (ok ? '✓' : '✗');

  return (
    <Card style={styles.card}>
      <Text style={[styles.name, { color: theme.colors.text }]}>{item.name}</Text>
      <Muted>{t('superadmin.competitionRequests.organizerLine', { name: organizerName })}</Muted>
      <Muted>
        {t('superadmin.competitionRequests.locationLine', {
          region: item.region,
          city: item.city,
          neighborhood: item.neighborhood,
        })}
      </Muted>
      <Muted>
        {t('superadmin.competitionRequests.venueLine', {
          name: item.venueName || '—',
        })}
      </Muted>
      <Muted>
        {t('superadmin.competitionRequests.requestedLine', {
          date: formatArabicDate(item.requestedAt),
          count: MIN_COMPETITION_TEAMS,
        })}
      </Muted>
      <Text style={[styles.status, { color: statusColor }]}>
        {t(`superadmin.requestStatus.${item.status}`)}
      </Text>
      <Muted>
        {t('superadmin.competitionRequests.pledgesLine', {
          diligence: pledgeMark(item.diligencePledge),
          stadium: pledgeMark(item.stadiumPledge),
          teams: pledgeMark(item.minTeamsPledge),
          firstAid: pledgeMark(item.firstAidPledge),
          order: pledgeMark(item.orderPledge),
        })}
      </Muted>
      {item.status === 'rejected' && item.rejectionReason ? (
        <Muted>
          {t('superadmin.competitionRequests.rejectionReason', {
            reason: item.rejectionReason,
          })}
        </Muted>
      ) : null}
      {pending ? (
        <View style={styles.actions}>
          <Button
            label={t('superadmin.competitionRequests.approveCreate')}
            onPress={onApprove}
            style={{ flex: 1 }}
          />
          <Button
            label={t('superadmin.competitionRequests.reject')}
            variant="danger"
            onPress={onReject}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </Card>
  );
});

export default function CompetitionRequestsScreen() {
  const {
    users,
    competitionRequests,
    approveCompetitionRequest,
    rejectCompetitionRequest,
  } = useTournament();
  const { t } = useTranslation();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const sorted = useMemo(
    () =>
      [...competitionRequests].sort((a, b) => {
        const order = { pending: 0, approved: 1, rejected: 2 };
        if (order[a.status] !== order[b.status]) {
          return order[a.status] - order[b.status];
        }
        return (
          new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
        );
      }),
    [competitionRequests]
  );

  const organizerName = useCallback(
    (organizerId: string) =>
      users.find((u) => u.id === organizerId)?.name || organizerId,
    [users]
  );

  const confirmReject = useCallback(() => {
    if (!rejectId) return;
    rejectCompetitionRequest(rejectId, rejectReason);
    setRejectId(null);
    setRejectReason('');
  }, [rejectId, rejectReason, rejectCompetitionRequest]);

  const renderItem = useCallback(
    ({ item }: { item: CompetitionRequest }) => (
      <RequestCard
        item={item}
        organizerName={organizerName(item.organizerId)}
        onApprove={() => {
          Alert.alert(
            t('superadmin.competitionRequests.approveAlertTitle'),
            t('superadmin.competitionRequests.approveAlertMessage', {
              name: item.name,
              count: MIN_COMPETITION_TEAMS,
            }),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('superadmin.actions.accept'),
                onPress: () => approveCompetitionRequest(item.id),
              },
            ]
          );
        }}
        onReject={() => {
          setRejectId(item.id);
          setRejectReason('');
        }}
      />
    ),
    [organizerName, approveCompetitionRequest, t]
  );

  return (
    <Screen>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.competitionRequests.title')}</Subtitle>
            <Muted>{t('superadmin.competitionRequests.subtitle')}</Muted>
            {rejectId ? (
              <Card style={{ gap: 8 }}>
                <Subtitle>{t('superadmin.competitionRequests.rejectReasonTitle')}</Subtitle>
                <Input
                  label={t('superadmin.labels.reason')}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder={t('superadmin.competitionRequests.reasonPlaceholder')}
                />
                <View style={styles.actions}>
                  <Button
                    label={t('superadmin.actions.confirmReject')}
                    variant="danger"
                    onPress={confirmReject}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={t('common.cancel')}
                    variant="ghost"
                    onPress={() => setRejectId(null)}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('superadmin.competitionRequests.emptyTitle')}
            description={t('superadmin.competitionRequests.emptyDesc')}
            icon="trophy-outline"
          />
        }
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 6 },
  name: { fontWeight: '800', textAlign: 'left', fontSize: 16 },
  status: { fontWeight: '800', textAlign: 'left', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
});

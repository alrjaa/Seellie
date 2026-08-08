import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTournament, type User } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Avatar,
  Button,
  Card,
  Input,
  Muted,
  SearchBar,
  Subtitle,
} from '@/components/ui';
import { formatArabicDate } from '@/utils';
import { isAnalystSuspendActive } from '@/utils/analyst';
import { matchesSearchQuery } from '@/utils/search';

type ModerationMode = 'warn' | 'suspend' | 'ban' | null;

function toInputDate(d = new Date()) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const RequestCard = memo(function RequestCard({
  user,
  onApprove,
  onReject,
  onWarn,
  onSuspend,
  onBan,
  onReinstate,
}: {
  user: User;
  onApprove: () => void;
  onReject: () => void;
  onWarn: () => void;
  onSuspend: () => void;
  onBan: () => void;
  onReinstate: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const status = user.analyst?.status || 'none';
  const pending = status === 'pending';
  const manageable =
    status === 'active' ||
    status === 'warned' ||
    status === 'suspended' ||
    status === 'approved' ||
    status === 'banned';
  const canReinstate =
    status === 'warned' || status === 'suspended' || status === 'banned';
  const suspendActive = isAnalystSuspendActive(user.analyst);
  const statusLabel =
    status in { pending: 1, approved: 1, active: 1, rejected: 1, warned: 1, suspended: 1, banned: 1 }
      ? t(`superadmin.analysts.analystStatus.${status}`)
      : status;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={user.avatar} name={user.name} size={44} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {user.name}
          </Text>
          <Muted>
            {user.handle} · {user.email}
          </Muted>
          <Muted>
            {statusLabel}
            {user.analyst?.requestedAt
              ? ` · ${formatArabicDate(user.analyst.requestedAt)}`
              : ''}
          </Muted>
          {user.analyst?.accessCode &&
          status !== 'pending' &&
          status !== 'banned' ? (
            <Muted>
              {t('superadmin.analysts.accessCodeSent', {
                code: user.analyst.accessCode,
              })}
            </Muted>
          ) : null}
          {status === 'warned' && user.analyst?.warningReason ? (
            <Muted>
              {t('superadmin.analysts.warningReason', {
                reason: user.analyst.warningReason,
              })}
            </Muted>
          ) : null}
          {status === 'suspended' ? (
            <Muted>
              {t('superadmin.analysts.tempSuspendLabel')}
              {user.analyst?.suspendFrom
                ? t('superadmin.analysts.suspendFrom', {
                    date: formatArabicDate(user.analyst.suspendFrom),
                  })
                : ''}
              {user.analyst?.suspendTo
                ? t('superadmin.analysts.suspendTo', {
                    date: formatArabicDate(user.analyst.suspendTo),
                  })
                : ''}
              {suspendActive
                ? t('superadmin.analysts.suspendActiveNow')
                : t('superadmin.analysts.suspendOutsidePeriod')}
              {user.analyst?.suspendReason
                ? ` · ${user.analyst.suspendReason}`
                : ''}
            </Muted>
          ) : null}
          {status === 'banned' && user.analyst?.banReason ? (
            <Muted>
              {t('superadmin.analysts.banReason', {
                reason: user.analyst.banReason,
              })}
            </Muted>
          ) : null}
        </View>
      </View>

      {pending ? (
        <View style={styles.actions}>
          <Button
            label={t('superadmin.analysts.approveSendCode')}
            onPress={onApprove}
            style={{ flex: 1 }}
          />
          <Button
            label={t('common.decline')}
            variant="danger"
            onPress={onReject}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      {manageable ? (
        <View style={styles.moderation}>
          <Muted>{t('superadmin.analysts.postApprovalActions')}</Muted>
          <View style={styles.actionsWrap}>
            <Button
              label={t('superadmin.actions.warn')}
              variant="secondary"
              onPress={onWarn}
            />
            <Button
              label={t('superadmin.actions.tempSuspend')}
              variant="outline"
              onPress={onSuspend}
            />
            <Button
              label={t('superadmin.actions.permanentBan')}
              variant="danger"
              onPress={onBan}
            />
            {canReinstate ? (
              <Button
                label={t('superadmin.actions.reinstate')}
                variant="ghost"
                onPress={onReinstate}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </Card>
  );
});

export default function AnalystsScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const {
    users,
    approveAnalystApplication,
    rejectAnalystApplication,
    warnAnalyst,
    suspendAnalyst,
    banAnalyst,
    reinstateAnalyst,
  } = useTournament();

  const [target, setTarget] = useState<User | null>(null);
  const [mode, setMode] = useState<ModerationMode>(null);
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState(toInputDate());
  const [toDate, setToDate] = useState(toInputDate(new Date(Date.now() + 7 * 86400000)));
  const [query, setQuery] = useState('');

  const closeModal = useCallback(() => {
    setTarget(null);
    setMode(null);
    setReason('');
  }, []);

  const openModeration = useCallback((user: User, next: ModerationMode) => {
    setTarget(user);
    setMode(next);
    setReason('');
    setFromDate(toInputDate());
    setToDate(toInputDate(new Date(Date.now() + 7 * 86400000)));
  }, []);

  const submitModeration = useCallback(() => {
    if (!target || !mode) return;
    let ok = false;
    if (mode === 'warn') ok = warnAnalyst(target.id, reason);
    if (mode === 'suspend') {
      ok = suspendAnalyst(target.id, fromDate, toDate, reason);
    }
    if (mode === 'ban') ok = banAnalyst(target.id, reason);
    if (ok) closeModal();
  }, [
    target,
    mode,
    reason,
    fromDate,
    toDate,
    warnAnalyst,
    suspendAnalyst,
    banAnalyst,
    closeModal,
  ]);

  const requests = useMemo(
    () =>
      users
        .filter((u) => u.analyst && u.analyst.status !== 'none')
        .filter((u) =>
          matchesSearchQuery(
            query,
            u.name,
            u.handle,
            u.email,
            u.visibleId,
            u.mobile,
            u.analyst?.accessCode,
            u.analyst?.status
          )
        )
        .sort((a, b) => {
          const order = {
            pending: 0,
            approved: 1,
            active: 2,
            warned: 3,
            suspended: 4,
            banned: 5,
            rejected: 6,
          };
          const sa = order[a.analyst!.status as keyof typeof order] ?? 9;
          const sb = order[b.analyst!.status as keyof typeof order] ?? 9;
          return sa - sb;
        }),
    [users, query]
  );

  const pendingCount = requests.filter(
    (u) => u.analyst?.status === 'pending'
  ).length;

  const renderItem = useCallback(
    ({ item }: { item: User }) => (
      <RequestCard
        user={item}
        onApprove={() => approveAnalystApplication(item.id)}
        onReject={() =>
          Alert.alert(
            t('superadmin.analysts.rejectAlertTitle'),
            t('superadmin.analysts.rejectAlertMessage'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.decline'),
                style: 'destructive',
                onPress: () =>
                  rejectAnalystApplication(
                    item.id,
                    t('superadmin.analysts.rejectDefaultReason')
                  ),
              },
            ]
          )
        }
        onWarn={() => openModeration(item, 'warn')}
        onSuspend={() => openModeration(item, 'suspend')}
        onBan={() => openModeration(item, 'ban')}
        onReinstate={() =>
          Alert.alert(
            t('superadmin.analysts.reinstateAlertTitle'),
            t('superadmin.analysts.reinstateAlertMessage'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('superadmin.actions.activate'),
                onPress: () => reinstateAnalyst(item.id),
              },
            ]
          )
        }
      />
    ),
    [
      approveAnalystApplication,
      rejectAnalystApplication,
      openModeration,
      reinstateAnalyst,
      t,
    ]
  );

  const modalTitle =
    mode === 'warn'
      ? t('superadmin.analysts.modals.warn')
      : mode === 'suspend'
        ? t('superadmin.analysts.modals.tempSuspend')
        : mode === 'ban'
          ? t('superadmin.analysts.modals.permanentBan')
          : '';

  return (
    <Screen>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Subtitle>{t('superadmin.analysts.title')}</Subtitle>
            <Muted>
              {t('superadmin.analysts.subtitle', { count: pendingCount })}
            </Muted>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={t('superadmin.searchPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              query.trim()
                ? t('superadmin.noSearchResults')
                : t('superadmin.analysts.emptyTitle')
            }
            description={
              query.trim() ? undefined : t('superadmin.analysts.emptyDesc')
            }
            icon="analytics-outline"
          />
        }
        renderItem={renderItem}
      />

      <Modal
        visible={!!target && !!mode}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeModal} />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Subtitle>{modalTitle}</Subtitle>
            {target ? (
              <Muted>
                {target.handle} · {target.email}
              </Muted>
            ) : null}

            {mode === 'suspend' ? (
              <>
                <Input
                  label={t('superadmin.analysts.fromDateLabel')}
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="2026-08-01"
                  ltr
                  autoCapitalize="none"
                />
                <Input
                  label={t('superadmin.analysts.toDateLabel')}
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="2026-08-15"
                  ltr
                  autoCapitalize="none"
                />
              </>
            ) : null}

            <Input
              label={t('superadmin.labels.reason')}
              value={reason}
              onChangeText={setReason}
              placeholder={t('superadmin.analysts.reasonPlaceholder')}
              multiline
            />

            <View style={styles.actions}>
              <Button
                label={t('common.confirm')}
                onPress={submitModeration}
                style={{ flex: 1 }}
                disabled={!reason.trim()}
              />
              <Button
                label={t('common.cancel')}
                variant="ghost"
                onPress={closeModal}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 12, gap: 12, paddingBottom: 40, paddingHorizontal: 0 },
  header: { gap: 6, marginBottom: 8 },
  card: { gap: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  name: { fontWeight: '800', textAlign: 'left' },
  actions: { flexDirection: 'row', gap: 8 },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moderation: { gap: 8 },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
    zIndex: 2,
  },
});

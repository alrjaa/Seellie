import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card, Muted, SearchBar, Subtitle, Title } from '@/components/ui';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useResponsive } from '@/hooks/useResponsive';
import { isSupabaseConfigured } from '@/services/supabase';
import {
  fetchAdminCommerceUserDetail,
  fetchAdminCommerceUsers,
} from '@/services/commerce/admin';
import type {
  AdminCommerceUserDetail,
  AdminCommerceUserSummary,
} from '@/services/commerce/types';

export default function CommerceMonitorScreen() {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const insets = useSafeAreaInsets();
  const { desktop } = useResponsive();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminCommerceUserSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCommerceUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = useCallback(async (search?: string) => {
    if (!isSupabaseConfigured()) {
      setUsers([]);
      setError('cloud_unavailable');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAdminCommerceUsers({ query: search, limit: 80 });
      setUsers(rows);
    } catch (e) {
      setUsers([]);
      setError(e instanceof Error ? e.message : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const onSearch = useCallback(
    (text: string) => {
      setQuery(text);
      void loadUsers(text);
    },
    [loadUsers]
  );

  const openDetail = useCallback(async (userId: string) => {
    setSelectedId(userId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const row = await fetchAdminCommerceUserDetail(userId);
      setDetail(row);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  const filtered = useMemo(() => users, [users]);

  const certName = useCallback(
    (nameAr?: string | null, nameEn?: string | null) =>
      isRTL ? nameAr || nameEn || '—' : nameEn || nameAr || '—',
    [isRTL]
  );

  if (!isSupabaseConfigured()) {
    return (
      <Screen density="dashboard">
        <Title>{t('superadmin.commerceMonitor.title')}</Title>
        <EmptyState
          title={t('superadmin.commerceMonitor.cloudRequiredTitle')}
          description={t('superadmin.commerceMonitor.cloudRequiredDesc')}
          icon="cloud-offline-outline"
        />
      </Screen>
    );
  }

  return (
    <Screen density="dashboard" scroll contentStyle={styles.content}>
      <Title>{t('superadmin.commerceMonitor.title')}</Title>
      <Muted>{t('superadmin.commerceMonitor.subtitle')}</Muted>
      <Card style={styles.noticeCard}>
        <Muted>{t('superadmin.commerceMonitor.readOnlyNotice')}</Muted>
      </Card>

      <SearchBar
        value={query}
        onChangeText={onSearch}
        placeholder={t('superadmin.commerceMonitor.searchPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : error ? (
        <EmptyState
          title={t('superadmin.commerceMonitor.loadFailedTitle')}
          description={t('superadmin.commerceMonitor.loadFailedDesc')}
          icon="alert-circle-outline"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('superadmin.commerceMonitor.emptyTitle')}
          description={t('superadmin.commerceMonitor.emptyDesc')}
          icon="wallet-outline"
        />
      ) : (
        <View style={[styles.grid, desktop && styles.gridDesktop]}>
          {filtered.map((user) => (
            <Pressable
              key={user.user_id}
              accessibilityRole="button"
              onPress={() => void openDetail(user.user_id)}
            >
              <Card style={styles.userCard}>
                <Subtitle>{user.name || '—'}</Subtitle>
                <Muted>
                  {user.handle || user.visible_id || user.user_id}
                </Muted>
                <View style={styles.statsRow}>
                  <Stat
                    label={t('superadmin.commerceMonitor.balance')}
                    value={user.balance_credits}
                    accent={theme.colors.accent}
                  />
                  <Stat
                    label={t('superadmin.commerceMonitor.purchased')}
                    value={user.total_purchased}
                  />
                  <Stat
                    label={t('superadmin.commerceMonitor.spent')}
                    value={user.total_spent}
                  />
                </View>
                <Muted>
                  {t('superadmin.commerceMonitor.giftStats', {
                    sent: user.certificates_sent,
                    received: user.certificates_received,
                  })}
                </Muted>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <Modal
        visible={!!selectedId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetail}
      >
        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.background,
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.modalHead}>
            <Title>{t('superadmin.commerceMonitor.detailTitle')}</Title>
            <Pressable accessibilityRole="button" onPress={closeDetail}>
              <Text style={{ color: theme.colors.accent, fontWeight: '800' }}>
                {t('common.close')}
              </Text>
            </Pressable>
          </View>

          {detailLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} />
          ) : !detail ? (
            <EmptyState
              title={t('superadmin.commerceMonitor.detailFailed')}
              icon="alert-circle-outline"
            />
          ) : (
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
              <Card style={styles.detailCard}>
                <Subtitle>{detail.profile.name}</Subtitle>
                <Muted>
                  {detail.profile.handle || detail.profile.visible_id}
                </Muted>
                <View style={styles.statsRow}>
                  <Stat
                    label={t('superadmin.commerceMonitor.balance')}
                    value={detail.profile.balance_credits}
                    accent={theme.colors.accent}
                  />
                  <Stat
                    label={t('superadmin.commerceMonitor.purchased')}
                    value={detail.profile.total_purchased}
                  />
                  <Stat
                    label={t('superadmin.commerceMonitor.spent')}
                    value={detail.profile.total_spent}
                  />
                </View>
                <Muted>
                  {t('superadmin.commerceMonitor.remaining', {
                    count: detail.profile.balance_credits,
                  })}
                </Muted>
              </Card>

              <Subtitle>{t('superadmin.commerceMonitor.purchasesSection')}</Subtitle>
              {detail.purchases.length === 0 ? (
                <Muted>{t('superadmin.commerceMonitor.noPurchases')}</Muted>
              ) : (
                detail.purchases.map((p) => (
                  <Card key={p.id} style={styles.lineCard}>
                    <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                      +{p.credits_amount} · {p.platform} · {p.status}
                    </Text>
                    <Muted>{p.product_id}</Muted>
                    <Muted>
                      {new Date(p.created_at).toLocaleString()} ·{' '}
                      {p.store_transaction_id}
                    </Muted>
                  </Card>
                ))
              )}

              <Subtitle>{t('superadmin.commerceMonitor.sentSection')}</Subtitle>
              {detail.sentCertificates.length === 0 ? (
                <Muted>{t('superadmin.commerceMonitor.noSent')}</Muted>
              ) : (
                detail.sentCertificates.map((c) => (
                  <Card key={c.id} style={styles.lineCard}>
                    <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                      {certName(c.name_ar, c.name_en)}
                    </Text>
                    <Muted>
                      {t('superadmin.commerceMonitor.toRecipient', {
                        name: c.recipient_name || '—',
                      })}
                    </Muted>
                    <Muted>
                      {t('commerce.creditsCost', { count: c.credits_cost })} ·{' '}
                      {c.certificate_number}
                    </Muted>
                    <Muted>{new Date(c.issued_at).toLocaleString()}</Muted>
                  </Card>
                ))
              )}

              <Subtitle>{t('superadmin.commerceMonitor.receivedSection')}</Subtitle>
              {detail.receivedCertificates.length === 0 ? (
                <Muted>{t('superadmin.commerceMonitor.noReceived')}</Muted>
              ) : (
                detail.receivedCertificates.map((c) => (
                  <Card key={c.id} style={styles.lineCard}>
                    <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                      {certName(c.name_ar, c.name_en)}
                    </Text>
                    <Muted>
                      {t('superadmin.commerceMonitor.fromSender', {
                        name: c.sender_name || '—',
                      })}
                    </Muted>
                    <Muted>
                      {t('commerce.creditsCost', { count: c.credits_cost })} ·{' '}
                      {c.certificate_number}
                    </Muted>
                    <Muted>{new Date(c.issued_at).toLocaleString()}</Muted>
                  </Card>
                ))
              )}

              <Subtitle>{t('superadmin.commerceMonitor.ledgerSection')}</Subtitle>
              {detail.ledger.length === 0 ? (
                <Muted>{t('superadmin.commerceMonitor.noLedger')}</Muted>
              ) : (
                detail.ledger.map((entry) => (
                  <Card key={entry.id} style={styles.lineCard}>
                    <View style={styles.ledgerTop}>
                      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                        {t(
                          `commerce.entry.${entry.entry_type}` as 'commerce.entry.CREDIT_PURCHASE'
                        )}
                      </Text>
                      <Text
                        style={{
                          color:
                            entry.amount_credits >= 0
                              ? theme.colors.accent
                              : theme.colors.danger,
                          fontWeight: '800',
                        }}
                      >
                        {entry.amount_credits > 0 ? '+' : ''}
                        {entry.amount_credits}
                      </Text>
                    </View>
                    <Muted>
                      {new Date(entry.created_at).toLocaleString()} ·{' '}
                      {t('commerce.balanceAfter', { count: entry.balance_after })}
                    </Muted>
                  </Card>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.stat}>
      <Muted>{label}</Muted>
      <Text
        style={{
          color: accent || theme.colors.text,
          fontWeight: '800',
          fontSize: 18,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 40 },
  noticeCard: { backgroundColor: 'transparent' },
  grid: { gap: 10 },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  userCard: { gap: 6, minWidth: 280, flexGrow: 1 },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  stat: { minWidth: 72, gap: 2 },
  modal: { flex: 1, paddingHorizontal: 16 },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailCard: { gap: 6 },
  lineCard: { gap: 4 },
  ledgerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

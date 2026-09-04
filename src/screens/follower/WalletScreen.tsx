import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/Screen';
import { HeaderBackButton } from '@/components/layout/HeaderBackButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, Muted, Subtitle, Title } from '@/components/ui';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useCommerce } from '@/providers/CommerceProvider';
import { useToast } from '@/providers/ToastProvider';
import type { CreditPackage } from '@/services/commerce/types';
import { cairoText } from '@/theme/fonts';

/**
 * Credits balance — opened from profile (not a main tab).
 * Flow: Balance → Recharge → choose package → store payment.
 */
export default function WalletScreen() {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const commerce = useCommerce();
  const [buyingSku, setBuyingSku] = useState<string | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const onBuy = useCallback(
    async (pkg: CreditPackage) => {
      if (buyingSku) return;
      setBuyingSku(pkg.sku);
      const result = await commerce.buyCredits(pkg);
      setBuyingSku(null);
      if (result.ok) {
        setRechargeOpen(false);
        toast({
          variant: 'success',
          title: t('commerce.creditsAdded'),
          description: t('commerce.creditsAddedDesc', {
            count: pkg.credits_amount,
          }),
        });
        return;
      }
      if (result.error === 'store_unavailable_on_web') {
        toast({
          variant: 'destructive',
          title: t('commerce.storeWebTitle'),
          description: t('commerce.storeWebDesc'),
        });
        return;
      }
      if (result.error === 'purchase_cancelled') return;
      toast({
        variant: 'destructive',
        title: t('commerce.purchaseFailed'),
        description: result.error || t('commerce.tryAgain'),
      });
    },
    [buyingSku, commerce, t, toast]
  );

  const history = useMemo(() => commerce.ledger, [commerce.ledger]);

  if (!commerce.ready) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={{ paddingBottom: insets.bottom + 16 }}>
      <View style={styles.headRow}>
        <HeaderBackButton />
        <Title style={{ flex: 1 }}>{t('commerce.balance')}</Title>
      </View>
      <Muted>{t('commerce.walletSubtitle')}</Muted>

      <Card style={[styles.balanceCard, { borderColor: theme.colors.accent }]}>
        <Muted>{t('commerce.currentCredits')}</Muted>
        <Text
          style={[
            styles.balanceValue,
            cairoText('extraBold'),
            { color: theme.colors.accent },
          ]}
        >
          {commerce.balanceCredits}
        </Text>
        <Muted>{t('commerce.creditsHint')}</Muted>
        <Button
          label={t('commerce.recharge')}
          onPress={() => setRechargeOpen(true)}
          style={{ marginTop: 8 }}
        />
      </Card>

      {rechargeOpen ? (
        <>
          <Subtitle>{t('commerce.recharge')}</Subtitle>
          <Muted>{t('commerce.rechargeHint')}</Muted>
          {Platform.OS === 'web' ? (
            <Card>
              <Muted>{t('commerce.storeWebDesc')}</Muted>
            </Card>
          ) : commerce.packages.length === 0 ? (
            <EmptyState
              title={t('commerce.noPackages')}
              description={t('commerce.noPackagesDesc')}
              icon="card-outline"
            />
          ) : (
            <View style={styles.packageGrid}>
              {commerce.packages.map((pkg) => {
                const name = isRTL ? pkg.name_ar : pkg.name_en;
                const busy = buyingSku === pkg.sku;
                return (
                  <Pressable
                    key={pkg.id}
                    accessibilityRole="button"
                    accessibilityLabel={name}
                    disabled={!!buyingSku}
                    onPress={() => void onBuy(pkg)}
                    style={({ pressed }) => [
                      styles.packageCard,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: pressed
                          ? theme.colors.accentSoft
                          : theme.colors.card,
                        opacity: buyingSku && !busy ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.packageCredits, { color: theme.colors.text }]}
                    >
                      {pkg.credits_amount}
                    </Text>
                    <Muted>{name}</Muted>
                    {pkg.price_display_sar ? (
                      <Text
                        style={{ color: theme.colors.accent, fontWeight: '700' }}
                      >
                        {pkg.price_display_sar} {t('commerce.sar')}
                      </Text>
                    ) : null}
                    {busy ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.accent}
                      />
                    ) : (
                      <Ionicons
                        name="add-circle"
                        size={22}
                        color={theme.colors.accent}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
          <Button
            label={t('common.cancel')}
            variant="outline"
            onPress={() => setRechargeOpen(false)}
          />
        </>
      ) : null}

      <Subtitle>{t('commerce.transactionHistory')}</Subtitle>
      {history.length === 0 ? (
        <Muted>{t('commerce.noTransactions')}</Muted>
      ) : (
        <FlatList
          data={history}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.historyRow}>
              <View style={styles.historyTop}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                  {t(
                    `commerce.entry.${item.entry_type}` as 'commerce.entry.CREDIT_PURCHASE'
                  )}
                </Text>
                <Text
                  style={{
                    color:
                      item.amount_credits >= 0
                        ? theme.colors.success || theme.colors.accent
                        : theme.colors.danger,
                    fontWeight: '800',
                  }}
                >
                  {item.amount_credits > 0 ? '+' : ''}
                  {item.amount_credits}
                </Text>
              </View>
              <Muted>
                {new Date(item.created_at).toLocaleString()} ·{' '}
                {t('commerce.balanceAfter', { count: item.balance_after })}
              </Muted>
            </Card>
          )}
        />
      )}

      {commerce.commerceAvailable ? (
        <>
          <Subtitle>{t('commerce.certificatesSent')}</Subtitle>
          {commerce.sentCertificates.length === 0 ? (
            <Muted>{t('commerce.noCertificates')}</Muted>
          ) : (
            commerce.sentCertificates.slice(0, 5).map((c) => (
              <Card key={c.id} style={styles.historyRow}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                  {c.name_en || c.name_ar}
                </Text>
                <Muted>
                  {t('certificates.certNumber')}: {c.certificate_number}
                </Muted>
              </Card>
            ))
          )}

          <Subtitle>{t('commerce.certificatesReceived')}</Subtitle>
          {commerce.receivedCertificates.length === 0 ? (
            <Muted>{t('commerce.noCertificates')}</Muted>
          ) : (
            commerce.receivedCertificates.slice(0, 5).map((c) => (
              <Card key={c.id} style={styles.historyRow}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                  {c.name_en || c.name_ar}
                </Text>
                <Muted>
                  {t('certificates.certNumber')}: {c.certificate_number}
                </Muted>
              </Card>
            ))
          )}
        </>
      ) : null}

      <Button
        label={t('commerce.goCertificates')}
        variant="outline"
        onPress={() => router.push('/(follower)/certificates' as any)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  balanceCard: {
    gap: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    paddingVertical: 20,
  },
  balanceValue: { fontSize: 42, letterSpacing: 0.5 },
  packageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  packageCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    alignItems: 'center',
  },
  packageCredits: { fontSize: 28, fontWeight: '800' },
  historyRow: { gap: 4, marginBottom: 8 },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});

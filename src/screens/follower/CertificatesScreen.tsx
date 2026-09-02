import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useTournament,
  type GiftTransaction,
  type SupportLevel,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { HeaderBackButton } from '@/components/layout/HeaderBackButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useResponsive } from '@/hooks/useResponsive';
import { headerSafeTop } from '@/theme/navigation';
import { certificateImageSource } from '@/theme/certificates';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Muted,
  SearchBar,
  Subtitle,
  Title,
} from '@/components/ui';
import { userHasRole } from '@/utils/roles';
import { cairoText } from '@/theme/fonts';
import {
  filterLevelsByKind,
  giftsReceivedBy,
  giftsSentBy,
  hasOfficialCertificateNumber,
  normalizeAppreciationStatus,
  resolveAppreciationKind,
  resolveAppreciationKindFromTx,
} from '@/utils/appreciation';

type CatalogTab = 'catalog' | 'sent' | 'received';

type SupportRecipient = {
  id: string;
  name: string;
  handle?: string;
  visibleId?: string;
  avatar?: string;
  type: GiftTransaction['recipientType'];
  subtitle: string;
};

const RecipientRow = memo(function RecipientRow({
  item,
  selected,
  onSelect,
}: {
  item: SupportRecipient;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onSelect}
      style={[
        styles.recipientRow,
        {
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          backgroundColor: selected
            ? theme.colors.accentSoft
            : theme.colors.surfaceElevated,
        },
      ]}
    >
      <Avatar uri={item.avatar} name={item.name} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.recipientName, { color: theme.colors.text }]}>
          {item.name}
        </Text>
        <Muted>
          {item.handle || item.visibleId || '—'} · {item.subtitle}
        </Muted>
      </View>
    </Pressable>
  );
});

function levelImageSource(level: SupportLevel) {
  const url = level.imageUrl || '';
  if (/^(file:|data:|https?:|content:|ph:|assets-library:)/i.test(url)) {
    return { uri: url };
  }
  return certificateImageSource(level.name) ?? { uri: url };
}

export default function CertificatesScreen() {
  const {
    supportLevels,
    users,
    competitions,
    currentUser,
    purchaseSupportGift,
    giftTransactions,
    featureFlags,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { desktop } = useResponsive();

  const [catalogTab, setCatalogTab] = useState<CatalogTab>('catalog');
  const [selectedLevel, setSelectedLevel] = useState<SupportLevel | null>(null);
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [recipient, setRecipient] = useState<SupportRecipient | null>(null);
  const [issued, setIssued] = useState<GiftTransaction | null>(null);
  const [buying, setBuying] = useState(false);

  const catalogLevels = useMemo(
    () =>
      [...filterLevelsByKind(supportLevels, 'certificate')].sort(
        (a, b) => (a.price ?? 0) - (b.price ?? 0)
      ),
    [supportLevels]
  );

  const sentHistory = useMemo(
    () =>
      currentUser ? giftsSentBy(giftTransactions, currentUser.id) : [],
    [giftTransactions, currentUser]
  );
  const receivedHistory = useMemo(
    () =>
      currentUser ? giftsReceivedBy(giftTransactions, currentUser.id) : [],
    [giftTransactions, currentUser]
  );

  const recipients = useMemo(() => {
    const list: SupportRecipient[] = [];

    users.forEach((u) => {
      if (u.status === 'suspended') return;
      if (userHasRole(u, 'organizer')) {
        list.push({
          id: u.id,
          name: u.name,
          handle: u.handle,
          visibleId: u.visibleId,
          avatar: u.avatar,
          type: 'organizer',
          subtitle: t('roles.organizer'),
        });
      }
      if (userHasRole(u, 'freelancer')) {
        list.push({
          id: u.id,
          name: u.name,
          handle: u.handle,
          visibleId: u.visibleId,
          avatar: u.avatar,
          type: 'freelancer',
          subtitle: t('roles.freelancer'),
        });
      }
    });

    competitions.forEach((comp) => {
      (comp.teams || []).forEach((team) => {
        (team.players || []).forEach((player) => {
          if (list.some((r) => r.id === player.id)) return;
          list.push({
            id: player.id,
            name: player.name,
            visibleId: player.visibleId,
            avatar: player.avatar,
            type: 'player',
            subtitle: t('certificates.playerOnTeam', { team: team.name }),
          });
        });
      });
    });

    return list;
  }, [users, competitions, t]);

  const filteredRecipients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients.slice(0, 40);
    return recipients
      .filter((r) => {
        const hay = [r.name, r.handle, r.visibleId, r.subtitle]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q.replace(/^@/, ''));
      })
      .slice(0, 40);
  }, [recipients, query]);

  const recipientTypeLabel = useCallback(
    (type: GiftTransaction['recipientType']) => {
      if (type === 'organizer') return t('roles.organizer');
      if (type === 'freelancer') return t('roles.freelancer');
      return t('certificates.player');
    },
    [t]
  );

  const statusLabel = useCallback(
    (status: string | undefined) => {
      const n = normalizeAppreciationStatus(status);
      return t(`appreciation.status.${n}` as 'appreciation.status.pending');
    },
    [t]
  );

  const closePurchase = useCallback(() => {
    setSelectedLevel(null);
    setQuery('');
    setReason('');
    setRecipient(null);
    setIssued(null);
    setBuying(false);
  }, []);

  const confirmPurchase = useCallback(() => {
    if (!selectedLevel || !recipient || buying) return;
    setBuying(true);
    const gift = purchaseSupportGift({
      certificateType: selectedLevel.name,
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientType: recipient.type,
      recipientVisibleId: recipient.visibleId || recipient.handle,
      reason: reason.trim() || undefined,
    });
    setBuying(false);
    if (gift) setIssued(gift);
  }, [buying, purchaseSupportGift, reason, recipient, selectedLevel]);

  const renderHistoryItem = useCallback(
    (item: GiftTransaction, perspective: 'sent' | 'received') => {
      const kind = resolveAppreciationKindFromTx(item);
      return (
        <Card key={item.id} style={styles.historyCard}>
          <Subtitle>
            {kind === 'certificate'
              ? t('appreciation.certificateItem', {
                  type: item.certificateType,
                })
              : t('appreciation.giftItem', { type: item.certificateType })}
          </Subtitle>
          <Muted>
            {perspective === 'sent'
              ? t('appreciation.toLine', { name: item.recipientName })
              : t('appreciation.fromLine', { name: item.gifterName })}
          </Muted>
          <Muted>
            {t('certificates.amount', { amount: item.amountPaid })}
          </Muted>
          <Muted>
            {t('appreciation.dateLine', {
              date: new Date(item.timestamp).toLocaleString(),
            })}
          </Muted>
          <Muted>
            {t('appreciation.statusLine', {
              status: statusLabel(item.status),
            })}
          </Muted>
          {kind === 'certificate' ? (
            <Muted>
              {hasOfficialCertificateNumber(item.certificateNumber)
                ? `${t('certificates.certNumber')}: ${item.certificateNumber}`
                : t('appreciation.certNumberPending')}
            </Muted>
          ) : null}
          {item.reason ? (
            <Muted>
              {t('appreciation.reasonLine', { reason: item.reason })}
            </Muted>
          ) : null}
        </Card>
      );
    },
    [statusLabel, t]
  );

  if (!featureFlags.appreciationEnabled) {
    return (
      <Screen
        edges={['left', 'right']}
        density={desktop ? 'wide' : 'default'}
        contentStyle={{
          ...styles.content,
          paddingTop: headerSafeTop(insets.top),
        }}
      >
        <View style={styles.topBar}>
          <HeaderBackButton />
          <Text
            style={[
              styles.pageTitle,
              cairoText('bold'),
              { color: theme.colors.text },
            ]}
            numberOfLines={1}
          >
            {t('appreciation.title')}
          </Text>
          <View style={styles.topBarEnd} />
        </View>
        <EmptyState
          title={t('appreciation.disabledTitle')}
          description={t('appreciation.disabledDesc')}
          icon="ribbon-outline"
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      edges={['left', 'right']}
      density={desktop ? 'wide' : 'default'}
      contentStyle={{ ...styles.content, paddingTop: headerSafeTop(insets.top) }}
    >
      <View style={styles.topBar}>
        <HeaderBackButton />
        <Text
          style={[
            styles.pageTitle,
            cairoText('bold'),
            { color: theme.colors.text },
          ]}
          numberOfLines={1}
        >
          {t('appreciation.title')}
        </Text>
        <View style={styles.topBarEnd} />
      </View>
      <Muted>{t('appreciation.subtitle')}</Muted>

      <View style={styles.tabs}>
        {(
          [
            ['catalog', t('appreciation.tabCatalog')],
            ['sent', t('appreciation.tabSent')],
            ['received', t('appreciation.tabReceived')],
          ] as const
        ).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            active={catalogTab === key}
            onPress={() => setCatalogTab(key)}
          />
        ))}
      </View>

      {catalogTab === 'sent' ? (
        sentHistory.length === 0 ? (
          <EmptyState
            title={t('appreciation.emptySentTitle')}
            description={t('appreciation.emptySentDesc')}
            icon="send-outline"
          />
        ) : (
          <View style={styles.historyList}>
            {sentHistory.map((g) => renderHistoryItem(g, 'sent'))}
          </View>
        )
      ) : catalogTab === 'received' ? (
        receivedHistory.length === 0 ? (
          <EmptyState
            title={t('appreciation.emptyReceivedTitle')}
            description={t('appreciation.emptyReceivedDesc')}
            icon="gift-outline"
          />
        ) : (
          <View style={styles.historyList}>
            {receivedHistory.map((g) => renderHistoryItem(g, 'received'))}
          </View>
        )
      ) : catalogLevels.length === 0 ? (
        <EmptyState
          title={t('appreciation.emptyCertificatesTitle')}
          description={t('appreciation.emptyCertificatesDesc')}
          icon="ribbon-outline"
        />
      ) : (
        <View style={[styles.levelsGrid, desktop && styles.levelsGridDesktop]}>
          {catalogLevels.map((level) => (
            <Card
              key={level.id || level.name}
              style={[styles.card, desktop && styles.cardDesktop]}
            >
              <Image
                source={levelImageSource(level)}
                style={[
                  styles.image,
                  { backgroundColor: theme.colors.surfaceElevated },
                ]}
                contentFit="contain"
                transition={200}
              />
              <View style={styles.body}>
                <Subtitle>{level.name}</Subtitle>
                <Text style={[styles.price, { color: theme.colors.accent }]}>
                  {t('certificates.price', { amount: level.price })}
                </Text>
                <Muted>{level.description}</Muted>
                <Button
                  label={t('appreciation.issueCertificate')}
                  onPress={() => {
                    setSelectedLevel(level);
                    setRecipient(null);
                    setIssued(null);
                    setQuery('');
                    setReason('');
                  }}
                  disabled={!currentUser}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      <Modal
        visible={!!selectedLevel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePurchase}
      >
        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.background,
              paddingTop: headerSafeTop(insets.top),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {issued ? (
            <View style={styles.modalBody}>
              <Title>
                {resolveAppreciationKindFromTx(issued) === 'certificate'
                  ? t('appreciation.certificateIssuedTitle')
                  : t('appreciation.giftIntentTitle')}
              </Title>
              <Card style={styles.certificate}>
                {resolveAppreciationKindFromTx(issued) === 'certificate' ? (
                  <>
                    {hasOfficialCertificateNumber(issued.certificateNumber) ? (
                      <>
                        <Muted>{t('certificates.certNumber')}</Muted>
                        <Text
                          style={[
                            styles.certNumber,
                            { color: theme.colors.accent },
                          ]}
                        >
                          {issued.certificateNumber}
                        </Text>
                      </>
                    ) : (
                      <Muted>{t('appreciation.certNumberPending')}</Muted>
                    )}
                    {issued.certificateTier ? (
                      <Muted>
                        {t('appreciation.tierLine', {
                          tier: issued.certificateTier,
                        })}
                      </Muted>
                    ) : null}
                  </>
                ) : (
                  <Muted>
                    {t('appreciation.refNumber')}: {issued.id}
                  </Muted>
                )}
                <Subtitle>
                  {t('certificates.certOf', { type: issued.certificateType })}
                </Subtitle>
                <Muted>
                  {t('certificates.amount', { amount: issued.amountPaid })}
                </Muted>
                <Muted>
                  {t('appreciation.statusLine', {
                    status: statusLabel(issued.status),
                  })}
                </Muted>
                <Muted>{t('appreciation.pendingPaymentHint')}</Muted>
                <View style={styles.certDivider} />
                <Muted>{t('certificates.beneficiary')}</Muted>
                <Text style={[styles.certName, { color: theme.colors.text }]}>
                  {issued.recipientName}
                </Text>
                <Text style={[styles.certId, { color: theme.colors.accent }]}>
                  {issued.recipientVisibleId || '—'}
                </Text>
                <Muted>
                  {t('certificates.typeLabel')}{' '}
                  {recipientTypeLabel(issued.recipientType)}
                </Muted>
                <Muted>
                  {t('certificates.from')} {issued.gifterName}
                </Muted>
                {issued.reason ? (
                  <Muted>
                    {t('appreciation.reasonLine', { reason: issued.reason })}
                  </Muted>
                ) : null}
              </Card>
              <Button label={t('certificates.done')} onPress={closePurchase} />
            </View>
          ) : (
            <View style={styles.modalBody}>
              <Title>
                {selectedLevel &&
                resolveAppreciationKind(selectedLevel) === 'certificate'
                  ? t('appreciation.directCertificateTitle', {
                      name: selectedLevel?.name ?? '',
                    })
                  : t('certificates.directTitle', {
                      name: selectedLevel?.name ?? '',
                    })}
              </Title>
              <Muted>{t('certificates.searchHint')}</Muted>
              {selectedLevel ? (
                <Text style={[styles.price, { color: theme.colors.accent }]}>
                  {t('certificates.price', {
                    amount: selectedLevel.price,
                  })}
                </Text>
              ) : null}

              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder={t('certificates.searchPlaceholder')}
              />

              <Input
                label={t('appreciation.reasonOptional')}
                value={reason}
                onChangeText={setReason}
                placeholder={t('appreciation.reasonPlaceholder')}
                multiline
              />

              {recipient ? (
                <Card style={styles.selectedCard}>
                  <Muted>{t('certificates.selectedBeneficiary')}</Muted>
                  <Text
                    style={[styles.recipientName, { color: theme.colors.text }]}
                  >
                    {recipient.name}
                  </Text>
                  <Text
                    style={[styles.certId, { color: theme.colors.accent }]}
                  >
                    {recipient.visibleId || recipient.handle || '—'}
                  </Text>
                  <Muted>{recipient.subtitle}</Muted>
                </Card>
              ) : null}

              <FlatList
                data={filteredRecipients}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <EmptyState
                    title={t('common.noResults')}
                    description={t('certificates.noResultsDesc')}
                    icon="search-outline"
                  />
                }
                renderItem={({ item }) => (
                  <RecipientRow
                    item={item}
                    selected={recipient?.id === item.id}
                    onSelect={() => setRecipient(item)}
                  />
                )}
              />

              <View style={styles.modalActions}>
                <Button
                  label={t('appreciation.confirmIntent')}
                  onPress={confirmPurchase}
                  disabled={!recipient || buying}
                  loading={buying}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t('common.cancel')}
                  variant="outline"
                  onPress={closePurchase}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 40 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelsGrid: { gap: 14 },
  levelsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  topBar: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topBarEnd: {
    width: 36,
  },
  pageTitle: {
    flex: 1,
    fontSize: 13,
    textAlign: 'center',
  },
  card: {
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  cardDesktop: {
    width: '48%',
    flexGrow: 1,
    minWidth: 320,
    maxWidth: '48%',
  },
  image: {
    width: '100%',
    aspectRatio: 900 / 674,
  },
  body: { gap: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  price: { fontSize: 18, fontWeight: '800', textAlign: 'left' },
  modal: { flex: 1, paddingHorizontal: 16 },
  modalBody: { flex: 1, gap: 12 },
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: 12 },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  recipientName: { fontWeight: '800', textAlign: 'left', fontSize: 14 },
  selectedCard: { gap: 4 },
  modalActions: { flexDirection: 'row', gap: 8 },
  certificate: { gap: 6 },
  certNumber: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'left',
    letterSpacing: 1,
  },
  certName: { fontSize: 16, fontWeight: '800', textAlign: 'left' },
  certId: { fontSize: 14, fontWeight: '700', textAlign: 'left' },
  certDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.35)',
    marginVertical: 6,
  },
  historyList: { gap: 10 },
  historyCard: { gap: 4 },
});

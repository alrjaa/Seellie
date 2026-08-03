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
import { AccountHeaderButton } from '@/components/layout/AccountHeaderButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { headerSafeTop } from '@/theme/navigation';
import {
  Avatar,
  Button,
  Card,
  Muted,
  SearchBar,
  Subtitle,
  Title,
} from '@/components/ui';
import { userHasRole } from '@/utils/roles';
import { cairoText } from '@/theme/fonts';

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
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected
            ? theme.colors.primarySoft
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

export default function CertificatesScreen() {
  const {
    supportLevels,
    users,
    competitions,
    currentUser,
    purchaseSupportGift,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const levels = useMemo(
    () => supportLevels.filter((l) => (l.name as string) !== 'محلل'),
    [supportLevels]
  );

  const [selectedLevel, setSelectedLevel] = useState<SupportLevel | null>(null);
  const [query, setQuery] = useState('');
  const [recipient, setRecipient] = useState<SupportRecipient | null>(null);
  const [issued, setIssued] = useState<GiftTransaction | null>(null);
  const [buying, setBuying] = useState(false);

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
      comp.teams.forEach((team) => {
        team.players.forEach((player) => {
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
        const hay = [
          r.name,
          r.handle,
          r.visibleId,
          r.subtitle,
        ]
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

  const closePurchase = useCallback(() => {
    setSelectedLevel(null);
    setQuery('');
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
    });
    setBuying(false);
    if (gift) setIssued(gift);
  }, [buying, purchaseSupportGift, recipient, selectedLevel]);

  return (
    <Screen
      scroll
      edges={['left', 'right']}
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
          {t('certificates.title')}
        </Text>
        <AccountHeaderButton
          accountHref="/(follower)/settings/account"
          settingsHref="/(follower)/settings"
          compact
        />
      </View>
      <Muted>{t('certificates.subtitle')}</Muted>

      {levels.length === 0 ? (
        <EmptyState
          title={t('certificates.emptyTitle')}
          description={t('certificates.emptyDesc')}
          icon="ribbon-outline"
        />
      ) : (
        levels.map((level) => (
          <Card key={level.name} style={styles.card}>
            <Image
              source={{ uri: level.imageUrl }}
              style={[
                styles.image,
                { backgroundColor: theme.colors.surfaceElevated },
              ]}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.body}>
              <Subtitle>{level.name}</Subtitle>
              <Text style={[styles.price, { color: theme.colors.primary }]}>
                {t('certificates.price', { amount: level.price })}
              </Text>
              <Muted>{level.description}</Muted>
              <Button
                label={t('certificates.buy')}
                onPress={() => {
                  setSelectedLevel(level);
                  setRecipient(null);
                  setIssued(null);
                  setQuery('');
                }}
                disabled={!currentUser}
              />
            </View>
          </Card>
        ))
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
              <Title>{t('certificates.supportCertificate')}</Title>
              <Card style={styles.certificate}>
                <Muted>{t('certificates.certNumber')}</Muted>
                <Text
                  style={[styles.certNumber, { color: theme.colors.primary }]}
                >
                  {issued.certificateNumber}
                </Text>
                <Subtitle>
                  {t('certificates.certOf', { type: issued.certificateType })}
                </Subtitle>
                <Muted>
                  {t('certificates.amount', {
                    amount: issued.amountPaid,
                  })}
                </Muted>
                <View style={styles.certDivider} />
                <Muted>{t('certificates.beneficiary')}</Muted>
                <Text style={[styles.certName, { color: theme.colors.text }]}>
                  {issued.recipientName}
                </Text>
                <Text style={[styles.certId, { color: theme.colors.primary }]}>
                  {issued.recipientVisibleId || '—'}
                </Text>
                <Muted>
                  {t('certificates.typeLabel')}{' '}
                  {recipientTypeLabel(issued.recipientType)}
                </Muted>
                <Muted>
                  {t('certificates.from')} {issued.gifterName}
                </Muted>
              </Card>
              <Button label={t('certificates.done')} onPress={closePurchase} />
            </View>
          ) : (
            <View style={styles.modalBody}>
              <Title>
                {t('certificates.directTitle', {
                  name: selectedLevel?.name ?? '',
                })}
              </Title>
              <Muted>{t('certificates.searchHint')}</Muted>
              {selectedLevel ? (
                <Text style={[styles.price, { color: theme.colors.primary }]}>
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

              {recipient ? (
                <Card style={styles.selectedCard}>
                  <Muted>{t('certificates.selectedBeneficiary')}</Muted>
                  <Text
                    style={[styles.recipientName, { color: theme.colors.text }]}
                  >
                    {recipient.name}
                  </Text>
                  <Text
                    style={[styles.certId, { color: theme.colors.primary }]}
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
                  label={t('certificates.confirmPurchase')}
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
  topBar: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageTitle: {
    flex: 1,
    fontSize: 13,
    textAlign: 'center',
  },
  card: { gap: 12, padding: 0, overflow: 'hidden' },
  image: { width: '100%', height: 140 },
  body: { gap: 8, padding: 14 },
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
});

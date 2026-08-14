import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTournament, type User } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import {
  ShareTargetModal,
  TinyShareButton,
  type ContentSharePayload,
} from '@/components/share/ShareTargetModal';
import { userHasRole } from '@/utils/roles';
import { Avatar, Button, Card, Input, Muted, Subtitle } from '@/components/ui';

const FreelancerRow = memo(function FreelancerRow({
  item,
  onOffer,
  onShareCard,
}: {
  item: User;
  onOffer: () => void;
  onShareCard: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={item.avatar} name={item.name} size={44} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.colors.text, flex: 1 }]}>
              {item.name}
            </Text>
            <TinyShareButton
              onPress={onShareCard}
              accessibilityLabel={t('shareCards.sendJoinCard')}
            />
          </View>
          <Muted>{item.handle}</Muted>
          <Muted>
            {t('organizer.freelancers.regIdLine', { id: item.visibleId })}
          </Muted>
          {item.bio ? (
            <Text
              style={[styles.bio, { color: theme.colors.textMuted }]}
              numberOfLines={2}
            >
              {item.bio}
            </Text>
          ) : null}
        </View>
      </View>
      <Button
        label={t('organizer.freelancers.sendOffer')}
        variant="secondary"
        onPress={onOffer}
      />
    </Card>
  );
});

export default function FreelancersScreen() {
  const { users, competitions, currentUser, sendOffer } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<User | null>(
    null
  );
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [sharePayload, setSharePayload] = useState<ContentSharePayload | null>(
    null
  );
  const [sendingOffer, setSendingOffer] = useState(false);

  const freelancers = useMemo(
    () => users.filter((u) => userHasRole(u, 'freelancer')),
    [users]
  );

  const myTeams = useMemo(() => {
    if (!currentUser) return [];
    return competitions
      .filter((c) => c.organizerId === currentUser.id)
      .flatMap((c) =>
        c.teams.map((team) => ({
          teamId: team.id,
          teamName: team.name,
          competitionName: c.name,
        }))
      );
  }, [competitions, currentUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return freelancers;
    return freelancers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.handle || '').toLowerCase().includes(q) ||
        (u.bio || '').toLowerCase().includes(q)
    );
  }, [freelancers, query]);

  const openOffer = useCallback((user: User) => {
    setSelectedFreelancer(user);
    setSelectedTeamId('');
    setOfferMessage('');
    setModalOpen(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: User }) => (
      <FreelancerRow
        item={item}
        onOffer={() => openOffer(item)}
        onShareCard={() =>
          setSharePayload({
            kind: 'join_request',
            presetRecipientId: item.id,
            presetRecipientName: item.name,
            presetRecipientKind: 'user',
            body: t('shareCards.defaultJoinNote', { name: item.name }),
          })
        }
      />
    ),
    [openOffer, t]
  );

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <Subtitle>{t('organizer.freelancers.title')}</Subtitle>
            <Muted>{t('organizer.freelancers.subtitle')}</Muted>
            <SearchBar value={query} onChangeText={setQuery} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('organizer.freelancers.empty')}
            icon="football-outline"
          />
        }
        renderItem={renderItem}
      />

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setModalOpen(false)}
          >
            <Pressable
              style={[
                styles.modal,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                contentContainerStyle={{ gap: 12 }}
                keyboardShouldPersistTaps="handled"
              >
              <Subtitle>
                {t('organizer.freelancers.offerTo', {
                  name:
                    selectedFreelancer?.name ||
                    t('organizer.freelancers.defaultPlayer'),
                })}
              </Subtitle>

              <Muted>{t('organizer.freelancers.chooseTeam')}</Muted>
              {myTeams.length === 0 ? (
                <Muted>{t('organizer.freelancers.noTeams')}</Muted>
              ) : (
                myTeams.map((team) => (
                  <Pressable
                    key={team.teamId}
                    onPress={() => setSelectedTeamId(team.teamId)}
                    style={[
                      styles.teamPick,
                      {
                        borderColor:
                          selectedTeamId === team.teamId
                            ? theme.colors.accent
                            : theme.colors.border,
                        backgroundColor:
                          selectedTeamId === team.teamId
                            ? theme.colors.accentSoft
                            : theme.colors.inputBg,
                      },
                    ]}
                  >
                    <Text style={[styles.name, { color: theme.colors.text }]}>
                      {team.teamName}
                    </Text>
                    <Muted>{team.competitionName}</Muted>
                  </Pressable>
                ))
              )}

              <Input
                label={t('organizer.freelancers.offerMessage')}
                value={offerMessage}
                onChangeText={setOfferMessage}
                multiline
                placeholder={t('organizer.freelancers.offerPlaceholder')}
              />

              <View style={styles.modalActions}>
                <Button
                  label={t('common.cancel')}
                  variant="ghost"
                  onPress={() => setModalOpen(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t('common.send')}
                  loading={sendingOffer}
                  disabled={sendingOffer || !selectedFreelancer || !selectedTeamId}
                  onPress={() => {
                    if (!selectedFreelancer || !selectedTeamId || sendingOffer) return;
                    setSendingOffer(true);
                    try {
                      const ok = sendOffer(
                        selectedFreelancer.id,
                        selectedTeamId,
                        offerMessage
                      );
                      if (ok) setModalOpen(false);
                    } finally {
                      setSendingOffer(false);
                    }
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      <ShareTargetModal
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: { fontWeight: '800', fontSize: 15 },
  bio: { fontSize: 12, lineHeight: 18 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    maxHeight: '85%',
  },
  teamPick: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  modalActions: { flexDirection: 'row', gap: 8 },
});

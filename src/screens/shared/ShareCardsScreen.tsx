import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import {
  StackTopChrome,
  stackTopChromePad,
} from '@/components/layout/StackTopChrome';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ShareCardPreview } from '@/components/share/ShareCardPreview';
import {
  Button,
  Card,
  Chip,
  Input,
  Muted,
  Subtitle,
  Title,
} from '@/components/ui';
import type { ShareCard, ShareCardKind } from '@/data/initial-data';
import { MEDIA_SPECS, PROFILE_VIDEO_MAX_SEC, validatePickerAsset } from '@/utils/media-limits';
import { persistLocalMediaUri } from '@/utils/persist-media';
import { userHasRole } from '@/utils/roles';

type Tab = 'inbox' | 'sent' | 'compose';

export default function ShareCardsScreen() {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const topPad = stackTopChromePad(insets.top);
  const {
    currentUser,
    users,
    competitions,
    shareCards,
    sendShareCard,
    updateShareCardStatus,
    markShareCardRead,
    routeForRole,
  } = useTournament();

  const [tab, setTab] = useState<Tab>('inbox');
  const [kind, setKind] = useState<ShareCardKind>('content');
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaKind, setMediaKind] = useState<'photo' | 'video' | 'text'>('text');
  const [competitionId, setCompetitionId] = useState('');
  const [competitionName, setCompetitionName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [position, setPosition] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [picking, setPicking] = useState(false);

  const recipients = useMemo(() => {
    if (!currentUser) return [];
    const q = recipientQuery.trim().toLowerCase();
    if (q.length < 2) return [] as {
      id: string;
      name: string;
      subtitle: string;
      kind: 'user' | 'referee';
    }[];
    const list: {
      id: string;
      name: string;
      subtitle: string;
      kind: 'user' | 'referee';
    }[] = [];

    users.forEach((u) => {
      if (u.id === currentUser.id) return;
      if (userHasRole(u, 'superadmin') || userHasRole(u, 'organizer')) return;
      const blob =
        `${u.name} ${u.handle || ''} ${u.email || ''} ${u.visibleId || ''}`.toLowerCase();
      if (!blob.includes(q)) return;
      list.push({
        id: u.id,
        name: u.name,
        subtitle: u.handle || u.visibleId || '',
        kind: 'user',
      });
    });

    return list.slice(0, 6);
  }, [users, currentUser, recipientQuery]);

  const selectedRecipient =
    recipients.find((r) => r.id === recipientId) ||
    (() => {
      if (!recipientId || !currentUser) return undefined;
      const u = users.find((x) => x.id === recipientId);
      if (!u || userHasRole(u, 'superadmin') || userHasRole(u, 'organizer')) {
        return undefined;
      }
      return {
        id: u.id,
        name: u.name,
        subtitle: u.handle || u.visibleId || '',
        kind: 'user' as const,
      };
    })();

  const myCompetitions = useMemo(() => {
    if (!currentUser) return [];
    if ((currentUser.activeRole || currentUser.role) === 'organizer') {
      return competitions.filter((c) => c.organizerId === currentUser.id);
    }
    return competitions;
  }, [competitions, currentUser]);

  const selectedCompetition = myCompetitions.find((c) => c.id === competitionId);
  const teams = selectedCompetition?.teams || [];

  const inbox = useMemo(
    () =>
      currentUser
        ? shareCards.filter((c) => c.recipientId === currentUser.id)
        : [],
    [shareCards, currentUser]
  );
  const sent = useMemo(
    () =>
      currentUser
        ? shareCards.filter((c) => c.senderId === currentUser.id)
        : [],
    [shareCards, currentUser]
  );
  const unreadInbox = useMemo(
    () => inbox.filter((c) => !c.read).length,
    [inbox]
  );

  if (!currentUser) return <Redirect href="/(auth)/login" />;

  const goHome = () => {
    router.replace(
      routeForRole(currentUser.activeRole || currentUser.role) as any
    );
  };

  const pickMedia = async (type: 'photo' | 'video') => {
    try {
      setPicking(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast({
          variant: 'destructive',
          title: t('media.permissionDenied'),
          description: t('media.allowLibrary'),
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'photo' ? ['images'] : ['videos'],
        quality: 0.85,
        allowsEditing: false,
        videoMaxDuration: PROFILE_VIDEO_MAX_SEC,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const check = validatePickerAsset(type === 'photo' ? 'photo' : 'video', {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        duration: asset.duration,
      });
      if (!check.ok) {
        toast({
          variant: 'destructive',
          title:
            check.reason === 'duration'
              ? t('media.videoTooLong')
              : check.reason === 'size'
                ? t('media.fileTooLarge')
                : t('media.imageTooSmall'),
          description:
            check.reason === 'size'
              ? t('media.fileTooLargeDesc', {
                  mb: MEDIA_SPECS[type === 'photo' ? 'photo' : 'video'].maxMb,
                })
              : undefined,
        });
        return;
      }
      setMediaUrl(await persistLocalMediaUri(asset.uri, type));
      setMediaKind(type);
      setKind('content');
    } catch {
      toast({
        variant: 'destructive',
        title: t('media.pickFailed'),
      });
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    if (!selectedRecipient) {
      toast({
        variant: 'destructive',
        title: t('shareCards.needRecipient'),
      });
      return;
    }
    const ok = await sendShareCard({
      kind,
      recipientId: selectedRecipient.id,
      recipientName: selectedRecipient.name,
      recipientKind: selectedRecipient.kind,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
      mediaUrl: mediaUrl.trim() || undefined,
      mediaKind: mediaUrl ? mediaKind : body ? 'text' : undefined,
      competitionId: competitionId || undefined,
      competitionName:
        competitionName.trim() || selectedCompetition?.name || undefined,
      teamId: teamId || undefined,
      teamName:
        teamName.trim() ||
        teams.find((x) => x.id === teamId)?.name ||
        undefined,
      position: position.trim() || undefined,
    });
    if (ok) {
      setTitle('');
      setBody('');
      setMediaUrl('');
      setCompetitionName('');
      setTeamName('');
      setPosition('');
      setRecipientId('');
      setTab('sent');
    }
  };

  const renderCardActions = (card: ShareCard) => {
    if (card.recipientId !== currentUser.id) return null;
    if (card.kind !== 'join_request' || card.status !== 'pending') {
      return (
        <Button
          label={t('shareCards.markSeen')}
          variant="ghost"
          onPress={() => {
            markShareCardRead(card.id);
            updateShareCardStatus(card.id, 'seen');
          }}
        />
      );
    }
    return (
      <View style={styles.rowBtns}>
        <Button
          label={t('shareCards.accept')}
          style={{ flex: 1 }}
          onPress={() => updateShareCardStatus(card.id, 'accepted')}
        />
        <Button
          label={t('shareCards.decline')}
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => updateShareCardStatus(card.id, 'declined')}
        />
      </View>
    );
  };

  const listData = tab === 'inbox' ? inbox : tab === 'sent' ? sent : [];

  return (
    <View style={styles.root}>
      <StackTopChrome />
      <Screen
        scroll={tab === 'compose'}
        hasTabBar={false}
        contentStyle={{ ...styles.content, paddingTop: topPad }}
      >
        <Title>{t('shareCards.title')}</Title>
        <Muted>{t('shareCards.subtitle')}</Muted>

        <View
          style={[
            styles.tabs,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          {(
            [
              ['inbox', t('shareCards.inbox')],
              ['sent', t('shareCards.sentTab')],
              ['compose', t('shareCards.compose')],
            ] as const
          ).map(([key, label]) => (
            <Chip
              key={key}
              label={
                key === 'inbox' && unreadInbox > 0
                  ? `${label} (${unreadInbox})`
                  : label
              }
              active={tab === key}
              onPress={() => setTab(key)}
            />
          ))}
        </View>

        {tab === 'compose' ? (
          <Card style={styles.form}>
            <Subtitle>{t('shareCards.chooseType')}</Subtitle>
            <View
              style={[
                styles.tabs,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <Chip
                label={t('shareCards.typeContent')}
                active={kind === 'content'}
                onPress={() => setKind('content')}
              />
              <Chip
                label={t('shareCards.typeJoin')}
                active={kind === 'join_request'}
                onPress={() => setKind('join_request')}
              />
            </View>

            <Input
              label={t('shareCards.searchRecipient')}
              value={recipientQuery}
              onChangeText={(v) => {
                setRecipientQuery(v);
                setRecipientId('');
              }}
              placeholder={t('shareCards.searchRecipientHint')}
              autoCapitalize="none"
            />
            {recipientQuery.trim().length > 0 &&
            recipientQuery.trim().length < 2 ? (
              <Muted>{t('shareCards.typeToSearch')}</Muted>
            ) : null}
            <View style={styles.recipientList}>
              {recipients.map((r) => (
                <Pressable
                  key={`${r.kind}-${r.id}`}
                  onPress={() => {
                    setRecipientId(r.id);
                    setRecipientQuery(
                      r.subtitle ? `${r.name} · ${r.subtitle}` : r.name
                    );
                  }}
                  style={[
                    styles.recipientRow,
                    {
                      borderColor:
                        recipientId === r.id
                          ? theme.colors.accent
                          : theme.colors.border,
                      backgroundColor: theme.colors.inputBg,
                    },
                  ]}
                >
                  <Subtitle>{r.name}</Subtitle>
                  {r.subtitle ? <Muted>{r.subtitle}</Muted> : null}
                </Pressable>
              ))}
            </View>
            {recipientQuery.trim().length >= 2 && recipients.length === 0 ? (
              <Muted>{t('shareCards.noSearchHit')}</Muted>
            ) : null}

            {kind === 'content' ? (
              <>
                <Input
                  label={t('shareCards.contentTitle')}
                  value={title}
                  onChangeText={setTitle}
                />
                <Input
                  label={t('shareCards.contentBody')}
                  value={body}
                  onChangeText={setBody}
                  multiline
                />
                <View style={styles.rowBtns}>
                  <Button
                    label={
                      picking ? t('media.picking') : t('media.pickPhotoFromDevice')
                    }
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => void pickMedia('photo')}
                  />
                  <Button
                    label={t('media.pickVideoFromDevice')}
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() => void pickMedia('video')}
                  />
                </View>
                {mediaUrl ? (
                  <View style={{ gap: 6 }}>
                    <Muted>
                      {t('shareCards.mediaAttached')}:{' '}
                      {mediaKind === 'photo'
                        ? t('common.photo')
                        : t('common.video')}
                    </Muted>
                    {mediaKind === 'photo' ? (
                      <Image
                        source={{ uri: mediaUrl }}
                        style={{
                          width: '100%',
                          height: 140,
                          borderRadius: 10,
                        }}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Button
                      label={t('shareCards.removeMedia')}
                      variant="ghost"
                      onPress={() => {
                        setMediaUrl('');
                        setMediaKind('text');
                      }}
                    />
                  </View>
                ) : (
                  <Muted>{t('shareCards.noMediaYet')}</Muted>
                )}
              </>
            ) : (
              <>
                <Muted>{t('shareCards.joinHint')}</Muted>
                {myCompetitions.length > 0 ? (
                  <View style={styles.wrapChips}>
                    {myCompetitions.map((c) => (
                      <Chip
                        key={c.id}
                        label={c.name}
                        active={competitionId === c.id}
                        onPress={() => {
                          setCompetitionId(c.id);
                          setCompetitionName(c.name);
                          setTeamId('');
                          setTeamName('');
                        }}
                      />
                    ))}
                  </View>
                ) : null}
                <Input
                  label={t('shareCards.competitionLabel')}
                  value={competitionName}
                  onChangeText={setCompetitionName}
                />
                {teams.length > 0 ? (
                  <View style={styles.wrapChips}>
                    {teams.map((team) => (
                      <Chip
                        key={team.id}
                        label={team.name}
                        active={teamId === team.id}
                        onPress={() => {
                          setTeamId(team.id);
                          setTeamName(team.name);
                        }}
                      />
                    ))}
                  </View>
                ) : null}
                <Input
                  label={t('shareCards.teamLabel')}
                  value={teamName}
                  onChangeText={setTeamName}
                />
                <Input
                  label={t('shareCards.positionLabel')}
                  value={position}
                  onChangeText={setPosition}
                  placeholder={t('shareCards.positionHint')}
                />
                <Input
                  label={t('shareCards.joinMessage')}
                  value={body}
                  onChangeText={setBody}
                  multiline
                />
              </>
            )}

            <Button
              label={t('shareCards.send')}
              onPress={() => void submit()}
            />
          </Card>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={listData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                title={t('shareCards.empty')}
                description={t('shareCards.emptyDesc')}
                icon="share-social-outline"
              />
            }
            renderItem={({ item }) => (
              <View style={styles.item}>
                <ShareCardPreview card={item} />
                <Muted>
                  {t('shareCards.status')}:{' '}
                  {t(`shareCards.status_${item.status}`)}
                </Muted>
                {tab === 'inbox' ? renderCardActions(item) : null}
              </View>
            )}
          />
        )}

        <Button
          label={t('notifications.backHome')}
          variant="primary"
          onPress={goHome}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 12, flex: 1, paddingBottom: 20 },
  tabs: { flexWrap: 'wrap', gap: 8 },
  form: { gap: 10 },
  recipientList: { gap: 6, maxHeight: 220 },
  recipientRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowBtns: { flexDirection: 'row', gap: 8 },
  list: { gap: 12, paddingBottom: 20, flexGrow: 1 },
  item: { gap: 8 },
});

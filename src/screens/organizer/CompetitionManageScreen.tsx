import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  useTournament,
  type Player,
  type Referee,
  type Team,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import { confirmDestructive } from '@/utils/confirm';
import {
  ShareTargetModal,
  TinyShareButton,
  type ContentSharePayload,
} from '@/components/share/ShareTargetModal';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Muted,
  Subtitle,
  Title,
} from '@/components/ui';
import { formatVenueAddress } from '@/utils/competition';
import { MIN_COMPETITION_TEAMS } from '@/utils/competition-request';
import {
  EntityAvatarEditModal,
  EntityAvatarField,
} from '@/components/account/EntityAvatarField';
import { formatArabicDate, formatArabicTime } from '@/utils';
import { MEDIA_SPECS, validatePickerAsset } from '@/utils/media-limits';
import { uniqueRefereesByName } from '@/utils/referee-name';
import {
  cloudWriteErrorMessage,
  requireCloudSession,
  resolvePublicMediaUrl,
} from '@/services/cloud-write';

const POSITION_OPTIONS: {
  value: Player['position'];
  key: 'goalkeeper' | 'defense' | 'midfield' | 'attack';
}[] = [
  { value: 'حارس مرمى', key: 'goalkeeper' },
  { value: 'دفاع', key: 'defense' },
  { value: 'وسط', key: 'midfield' },
  { value: 'هجوم', key: 'attack' },
];

const REFEREE_ROLE_OPTIONS: {
  value: Referee['role'];
  key: 'pitch' | 'assistant' | 'observer';
}[] = [
  { value: 'حكم ساحة', key: 'pitch' },
  { value: 'رجل خط', key: 'assistant' },
  { value: 'مراقب', key: 'observer' },
];

export default function CompetitionManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const {
    competitions,
    currentUser,
    users,
    referees,
    addTeam,
    renameCompetition,
    deleteCompetition,
    renameTeam,
    deleteTeam,
    addPlayerToTeam,
    updatePlayerAvatar,
    addStaffToCompetition,
    updateStaffAvatar,
    removeStaffFromCompetition,
    generateFixturesForCompetition,
    updateMatchResult,
    registerRefereeForCompetition,
    assignRefereeToCompetition,
    removeRefereeFromCompetition,
    updateReferee,
    updateCompetition,
    updateTeamLogo,
  } = useTournament();
  const { toast } = useToast();
  const [pickingLogo, setPickingLogo] = useState(false);
  const [sharePayload, setSharePayload] = useState<ContentSharePayload | null>(
    null
  );

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamLogo, setTeamLogo] = useState<string | undefined>();
  const [editCompetitionName, setEditCompetitionName] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState<Player['position']>('وسط');
  const [playerAvatar, setPlayerAvatar] = useState<string | undefined>();
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [staffMobile, setStaffMobile] = useState('');
  const [staffAvatar, setStaffAvatar] = useState<string | undefined>();
  const [refereeName, setRefereeName] = useState('');
  const [refereeRole, setRefereeRole] =
    useState<Referee['role']>('حكم ساحة');
  const [refereeMobile, setRefereeMobile] = useState('');
  const [refereeCity, setRefereeCity] = useState('');
  const [refereeAvatar, setRefereeAvatar] = useState<string | undefined>();
  const [avatarEdit, setAvatarEdit] = useState<
    | {
        kind: 'player' | 'staff' | 'referee';
        id: string;
        teamId?: string;
        name: string;
        value?: string;
      }
    | null
  >(null);
  const [scores, setScores] = useState<
    Record<string, { t1: number; t2: number }>
  >({});

  const competition = useMemo(() => {
    const found = competitions.find((c) => c.id === id);
    if (!found || !currentUser) return undefined;
    if (found.organizerId !== currentUser.id) return undefined;
    return found;
  }, [competitions, id, currentUser]);

  useEffect(() => {
    if (competition) setEditCompetitionName(competition.name);
  }, [competition?.id, competition?.name]);

  useEffect(() => {
    if (!competition || !selectedTeamId) {
      setEditTeamName('');
      return;
    }
    const team = competition.teams.find((item) => item.id === selectedTeamId);
    setEditTeamName(team?.name || '');
  }, [competition, selectedTeamId]);

  const assignedRefs = useMemo(
    () =>
      uniqueRefereesByName(
        referees.filter((r) => competition?.refereeIds.includes(r.id))
      ),
    [referees, competition]
  );

  const availableRefs = useMemo(
    () => referees.filter((r) => !competition?.refereeIds.includes(r.id)),
    [referees, competition]
  );

  const sortedMatches = useMemo(() => {
    if (!competition) return [];
    return [...competition.matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [competition]);

  if (!competition) {
    return (
      <Screen contentStyle={styles.content}>
        <EmptyState
          title={t('superadmin.competitionDetail.notFound')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
          icon="trophy-outline"
        />
      </Screen>
    );
  }

  const teamNameById = (teamId: string) =>
    competition.teams.find((team) => team.id === teamId)?.name || '?';

  const getScore = (matchId: string, t1: number, t2: number) =>
    scores[matchId] || { t1, t2 };

  const adjustScore = (
    matchId: string,
    t1: number,
    t2: number,
    side: 't1' | 't2',
    delta: number
  ) => {
    const current = getScore(matchId, t1, t2);
    const next = {
      ...current,
      [side]: Math.max(0, current[side] + delta),
    };
    setScores((prev) => ({ ...prev, [matchId]: next }));
    updateMatchResult(competition.id, matchId, next.t1, next.t2);
  };

  const confirmDeleteCompetition = async () => {
    const ok = await confirmDestructive({
      title: t('organizer.competitionManage.deleteCompetition'),
      message: t('organizer.competitionManage.deleteCompetitionConfirm'),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('organizer.competitionManage.deleteCompetition'),
    });
    if (!ok) return;
    if (await deleteCompetition(competition.id)) {
      router.replace('/(organizer)/competitions');
    }
  };

  const confirmDeleteTeam = async (team: Team) => {
    const ok = await confirmDestructive({
      title: t('organizer.competitionManage.deleteTeam'),
      message: t('organizer.competitionManage.deleteTeamConfirm'),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('organizer.competitionManage.deleteTeam'),
    });
    if (!ok) return;
    if (deleteTeam(competition.id, team.id)) {
      if (selectedTeamId === team.id) setSelectedTeamId(null);
    }
  };

  const openJoinShareForPlayer = (player: Player, team: Team) => {
    if (!competition) return;
    const matched =
      users.find(
        (u) =>
          u.id === player.id ||
          (player.email && u.email === player.email) ||
          u.name.trim().toLowerCase() === player.name.trim().toLowerCase()
      ) || null;
    setSharePayload({
      kind: 'join_request',
      competitionId: competition.id,
      competitionName: competition.name,
      teamId: team.id,
      teamName: team.name,
      position: player.position,
      presetRecipientId: matched?.id,
      presetRecipientName: matched?.name || player.name,
      presetRecipientKind: 'user',
      body: t('shareCards.defaultJoinNote', {
        name: matched?.name || player.name,
      }),
    });
  };

  const renderTeam = (team: Team) => {
    const selected = selectedTeamId === team.id;
    return (
      <View key={team.id} style={{ gap: 6 }}>
        <Pressable
          onPress={() => setSelectedTeamId(team.id)}
          style={[
            styles.teamRow,
            {
              borderColor: selected ? theme.colors.accent : theme.colors.border,
              backgroundColor: selected
                ? theme.colors.accentSoft
                : theme.colors.inputBg,
            },
          ]}
        >
          <Avatar uri={team.logo} name={team.name} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {team.name}
            </Text>
            <Muted>
              {t('organizer.competitionManage.playersCount', {
                count: team.players.length,
              })}
            </Muted>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              confirmDeleteTeam(team);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('organizer.competitionManage.deleteTeam')}
          >
            <Text
              style={{
                color: theme.colors.danger,
                fontWeight: '800',
                fontSize: 12,
              }}
            >
              {t('organizer.competitionManage.deleteTeam')}
            </Text>
          </Pressable>
        </Pressable>
        {selected
          ? team.players.map((player) => (
              <View
                key={player.id}
                style={[
                  styles.playerRow,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                  },
                ]}
              >
                <Avatar uri={player.avatar} name={player.name} size={28} />
                <View style={styles.playerNameRow}>
                  <Text
                    style={[styles.playerName, { color: theme.colors.text }]}
                    numberOfLines={1}
                  >
                    {player.name}
                  </Text>
                  <TinyShareButton
                    onPress={() => openJoinShareForPlayer(player, team)}
                    accessibilityLabel={t('shareCards.sendJoinCard')}
                  />
                </View>
                <Muted>
                  #{player.jerseyNumber} · {player.position}
                </Muted>
                <Pressable
                  onPress={() =>
                    setAvatarEdit({
                      kind: 'player',
                      id: player.id,
                      teamId: team.id,
                      name: player.name,
                      value: player.avatar,
                    })
                  }
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('media.entityPhotoLabel')}
                >
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontWeight: '700',
                      fontSize: 11,
                    }}
                  >
                    {t('media.changeHandleIcon')}
                  </Text>
                </Pressable>
              </View>
            ))
          : null}
      </View>
    );
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Avatar uri={competition.logo} name={competition.name} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Title>{competition.name}</Title>
          <Muted>{competition.visibleId}</Muted>
        </View>
      </View>

      {competition.status === 'warned' || competition.status === 'suspended' ? (
        <Card style={styles.card}>
          <Text
            style={{
              color:
                competition.status === 'suspended'
                  ? theme.colors.danger
                  : theme.colors.warning,
              fontWeight: '800',
            }}
          >
            {competition.status === 'warned'
              ? t('organizer.competitionManage.warningTitle')
              : t('organizer.competitionManage.suspendedTitle')}
          </Text>
          {competition.statusReason ? (
            <Muted>
              {t('superadmin.competitionDetail.reasonLine', {
                reason: competition.statusReason,
              })}
            </Muted>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Subtitle>{t('organizer.competitionManage.logoSection')}</Subtitle>
        <MediaUploadSpecs
          kind="logo"
          title={t('media.specs.logoTitle')}
          compact
        />
        <Button
          label={
            pickingLogo
              ? t('media.picking')
              : t('organizer.competitionManage.changeLogo')
          }
          variant="secondary"
          loading={pickingLogo}
          onPress={async () => {
            try {
              setPickingLogo(true);
              const perm =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
              // على الويب الصلاحية غالباً غير مطلوبة / غير دقيقة
              if (!perm.granted && Platform.OS !== 'web') {
                toast({
                  variant: 'destructive',
                  title: t('media.permissionDenied'),
                  description: t('media.allowLibrary'),
                });
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.85,
                // allowsEditing يكسر الالتقاط على متصفح الكمبيوتر
                allowsEditing: Platform.OS !== 'web',
                aspect: [1, 1],
                exif: false,
              });
              if (result.canceled || !result.assets?.[0]?.uri) return;
              const asset = result.assets[0];
              const check = validatePickerAsset('logo', {
                uri: asset.uri,
                width: asset.width,
                height: asset.height,
                fileSize: asset.fileSize,
              });
              // لا نرفض بالأبعاد بعد القصّ/الويب — الحجم فقط
              if (!check.ok && check.reason === 'size') {
                toast({
                  variant: 'destructive',
                  title: t('media.fileTooLarge'),
                  description: t('media.fileTooLargeDesc', {
                    mb: MEDIA_SPECS.logo.maxMb,
                  }),
                });
                return;
              }

              const cloud = await requireCloudSession(currentUser?.id);
              if (!cloud.session) {
                toast({
                  variant: 'destructive',
                  title: t('media.uploadFailedKeepLocal'),
                  description: cloudWriteErrorMessage(cloud.error),
                });
                return;
              }

              const resolved = await resolvePublicMediaUrl({
                uri: asset.uri,
                kind: 'photo',
                folder: 'competitions',
                userId: cloud.session.userId,
                requireCloud: true,
              });
              if (!resolved.url) {
                toast({
                  variant: 'destructive',
                  title: t('media.uploadFailedKeepLocal'),
                  description: cloudWriteErrorMessage(resolved.error),
                });
                return;
              }

              updateCompetition(
                { ...competition, logo: resolved.url },
                t('organizer.competitionManage.logoUpdated')
              );
            } catch (e) {
              console.warn('[competition logo]', e);
              toast({
                variant: 'destructive',
                title: t('media.pickFailed'),
                description: t('media.pickFailedHint'),
              });
            } finally {
              setPickingLogo(false);
            }
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Subtitle>
          {t('organizer.competitionManage.registerRefereeSection')}
        </Subtitle>
        <Input
          label={t('organizer.competitionManage.refereeName')}
          value={refereeName}
          onChangeText={setRefereeName}
        />
        <EntityAvatarField
          value={refereeAvatar}
          name={refereeName || '?'}
          folder="referees"
          onChange={setRefereeAvatar}
          compact
        />
        <Muted>{t('organizer.competitionManage.refereeRole')}</Muted>
        <View style={styles.chips}>
          {REFEREE_ROLE_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={t(
                `organizer.competitionManage.refereeRoles.${option.key}`
              )}
              active={refereeRole === option.value}
              onPress={() => setRefereeRole(option.value)}
            />
          ))}
        </View>
        <Input
          label={t('organizer.competitionManage.refereeMobile')}
          value={refereeMobile}
          onChangeText={setRefereeMobile}
          keyboardType="phone-pad"
        />
        <Input
          label={t('organizer.competitionManage.refereeCity')}
          value={refereeCity}
          onChangeText={setRefereeCity}
        />
        <Button
          label={t('organizer.competitionManage.registerReferee')}
          onPress={() => {
            if (
              registerRefereeForCompetition(competition.id, {
                name: refereeName,
                role: refereeRole,
                mobile: refereeMobile,
                city: refereeCity,
                avatar: refereeAvatar,
              })
            ) {
              setRefereeName('');
              setRefereeMobile('');
              setRefereeCity('');
              setRefereeAvatar(undefined);
              setRefereeRole('حكم ساحة');
            }
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.competitionManage.editCompetitionName')}</Subtitle>
        <Input
          label={t('organizer.requestCompetition.competitionName')}
          value={editCompetitionName}
          onChangeText={setEditCompetitionName}
        />
        <Button
          label={t('organizer.competitionManage.saveCompetitionName')}
          onPress={() =>
            renameCompetition(
              competition.id,
              editCompetitionName,
              t('toasts.competitionRenamed')
            )
          }
        />
        <Button
          label={t('organizer.competitionManage.deleteCompetition')}
          variant="danger"
          onPress={confirmDeleteCompetition}
        />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('superadmin.competitionDetail.venueSection')}</Subtitle>
        <Text style={[styles.value, { color: theme.colors.text }]}>
          {competition.venue?.name || t('superadmin.labels.notSet')}
        </Text>
        <Muted>{formatVenueAddress(competition)}</Muted>
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.competitionManage.teams')}</Subtitle>
        {competition.teams.length === 0 ? (
          <EmptyState
            title={t('organizer.competitionManage.noTeams')}
            icon="people-outline"
          />
        ) : (
          competition.teams.map(renderTeam)
        )}

        {selectedTeamId ? (
          <>
            <Subtitle>{t('organizer.competitionManage.editTeamName')}</Subtitle>
            <Input
              label={t('organizer.competitionManage.teamName')}
              value={editTeamName}
              onChangeText={setEditTeamName}
            />
            <Button
              label={t('organizer.competitionManage.saveTeamName')}
              onPress={() =>
                renameTeam(
                  competition.id,
                  selectedTeamId,
                  editTeamName,
                  t('toasts.teamRenamed')
                )
              }
            />
            <Subtitle>{t('organizer.competitionManage.teamLogoSection')}</Subtitle>
            <EntityAvatarField
              value={
                competition.teams.find((item) => item.id === selectedTeamId)
                  ?.logo
              }
              name={editTeamName || '?'}
              folder="teams"
              onChange={(url) =>
                updateTeamLogo(competition.id, selectedTeamId, url)
              }
              compact
            />
          </>
        ) : null}

        <Subtitle>{t('organizer.competitionManage.addTeam')}</Subtitle>
        <Input
          label={t('organizer.competitionManage.teamName')}
          value={teamName}
          onChangeText={setTeamName}
          placeholder={t('organizer.competitionManage.teamNamePlaceholder')}
        />
        <EntityAvatarField
          value={teamLogo}
          name={teamName || '?'}
          folder="teams"
          onChange={setTeamLogo}
          compact
        />
        <Button
          label={t('superadmin.actions.add')}
          onPress={() => {
            if (!teamName.trim()) return;
            addTeam(
              competition.id,
              { name: teamName.trim(), logo: teamLogo },
              t('organizer.competitionManage.teamAdded')
            );
            setTeamName('');
            setTeamLogo(undefined);
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.competitionManage.addPlayerSection')}</Subtitle>
        {!selectedTeamId ? (
          <Muted>{t('organizer.competitionManage.selectTeamFirst')}</Muted>
        ) : (
          <>
            <Muted>
              {t('organizer.competitionManage.selectedTeam', {
                name:
                  competition.teams.find((team) => team.id === selectedTeamId)
                    ?.name || '',
              })}
            </Muted>
            <Input
              label={t('organizer.competitionManage.playerName')}
              value={playerName}
              onChangeText={setPlayerName}
            />
            <Input
              label={t('organizer.competitionManage.jerseyNumber')}
              value={jersey}
              onChangeText={(v) => setJersey(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
            <Muted>{t('organizer.competitionManage.position')}</Muted>
            <View style={styles.chips}>
              {POSITION_OPTIONS.map((option) => (
                <Chip
                  key={option.key}
                  label={t(`organizer.competitionManage.positions.${option.key}`)}
                  active={position === option.value}
                  onPress={() => setPosition(option.value)}
                />
              ))}
            </View>
            <EntityAvatarField
              value={playerAvatar}
              name={playerName || '?'}
              folder="players"
              onChange={setPlayerAvatar}
              compact
            />
            <Button
              label={t('organizer.competitionManage.addPlayer')}
              onPress={() => {
                if (!playerName.trim() || !jersey) return;
                addPlayerToTeam(
                  competition.id,
                  selectedTeamId,
                  {
                    name: playerName.trim(),
                    jerseyNumber: Number(jersey),
                    position,
                    avatar: playerAvatar,
                  },
                  t('organizer.competitionManage.playerAdded')
                );
                setPlayerName('');
                setJersey('');
                setPlayerAvatar(undefined);
              }}
            />
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.competitionManage.fixtures')}</Subtitle>
        {competition.fixturesSuspended ? (
          <>
            <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>
              {t('superadmin.competitionDetail.fixturesSuspendedBadge')}
            </Text>
            {competition.fixturesSuspendReason ? (
              <Muted>
                {t('superadmin.competitionDetail.fixturesSuspendReasonLine', {
                  reason: competition.fixturesSuspendReason,
                })}
              </Muted>
            ) : null}
          </>
        ) : null}
        {competition.matches.length === 0 ? (
          <>
            <Muted>
              {t('organizer.competitionManage.noFixturesHint', {
                count: MIN_COMPETITION_TEAMS,
              })}
            </Muted>
            <Button
              label={t('organizer.competitionManage.createDraw')}
              onPress={() => generateFixturesForCompetition(competition.id)}
            />
          </>
        ) : (
          <>
            <Muted>{t('organizer.competitionManage.fixturesTableHint')}</Muted>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tableScroll}
            >
              <View style={styles.table}>
                <View
                  style={[
                    styles.tableHead,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.th,
                      styles.colNum,
                      { color: theme.colors.accent },
                    ]}
                  >
                    {t('organizer.competitionManage.colNum')}
                  </Text>
                  <Text
                    style={[
                      styles.th,
                      styles.colDate,
                      { color: theme.colors.accent },
                    ]}
                  >
                    {t('organizer.competitionManage.colDate')}
                  </Text>
                  <Text
                    style={[
                      styles.th,
                      styles.colTime,
                      { color: theme.colors.accent },
                    ]}
                  >
                    {t('organizer.competitionManage.colTime')}
                  </Text>
                  <Text
                    style={[
                      styles.th,
                      styles.colTeam,
                      { color: theme.colors.accent },
                    ]}
                  >
                    {t('organizer.competitionManage.colHome')}
                  </Text>
                  <Text
                    style={[
                      styles.th,
                      styles.colScore,
                      { color: theme.colors.accent },
                    ]}
                  >
                    {t('organizer.competitionManage.colScore')}
                  </Text>
                  <Text
                    style={[
                      styles.th,
                      styles.colTeam,
                      { color: theme.colors.accent },
                    ]}
                  >
                    {t('organizer.competitionManage.colAway')}
                  </Text>
                </View>

                {sortedMatches.map((match, index) => {
                  const s = getScore(
                    match.id,
                    match.team1Score,
                    match.team2Score
                  );
                  const zebra =
                    index % 2 === 0
                      ? theme.colors.card
                      : theme.colors.inputBg;
                  const locked = !!competition.fixturesSuspended;
                  return (
                    <View
                      key={match.id}
                      style={[
                        styles.tableRow,
                        {
                          backgroundColor: zebra,
                          borderColor: theme.colors.border,
                          opacity: locked ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.td,
                          styles.colNum,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {index + 1}
                      </Text>
                      <Text
                        style={[
                          styles.td,
                          styles.colDate,
                          { color: theme.colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {formatArabicDate(match.date)}
                      </Text>
                      <Text
                        style={[
                          styles.td,
                          styles.colTime,
                          { color: theme.colors.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {formatArabicTime(match.date)}
                      </Text>
                      <Text
                        style={[
                          styles.td,
                          styles.colTeam,
                          styles.teamCell,
                          { color: theme.colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {teamNameById(match.team1Id)}
                      </Text>
                      <View style={[styles.colScore, styles.scoreCell]}>
                        <Pressable
                          disabled={locked}
                          onPress={() =>
                            adjustScore(
                              match.id,
                              match.team1Score,
                              match.team2Score,
                              't1',
                              1
                            )
                          }
                          style={[
                            styles.scoreBtnSm,
                            { backgroundColor: theme.colors.accentSoft },
                          ]}
                          hitSlop={4}
                        >
                          <Text
                            style={{
                              color: theme.colors.accent,
                              fontWeight: '900',
                              fontSize: 11,
                            }}
                          >
                            +
                          </Text>
                        </Pressable>
                        <Text
                          style={[
                            styles.scoreValue,
                            { color: theme.colors.text },
                          ]}
                        >
                          {s.t1}
                        </Text>
                        <Pressable
                          disabled={locked}
                          onPress={() =>
                            adjustScore(
                              match.id,
                              match.team1Score,
                              match.team2Score,
                              't1',
                              -1
                            )
                          }
                          style={[
                            styles.scoreBtnSm,
                            { backgroundColor: theme.colors.border },
                          ]}
                          hitSlop={4}
                        >
                          <Text
                            style={{
                              color: theme.colors.textMuted,
                              fontWeight: '900',
                              fontSize: 11,
                            }}
                          >
                            −
                          </Text>
                        </Pressable>
                        <Text
                          style={{
                            color: theme.colors.textMuted,
                            fontWeight: '800',
                            marginHorizontal: 2,
                          }}
                        >
                          :
                        </Text>
                        <Pressable
                          disabled={locked}
                          onPress={() =>
                            adjustScore(
                              match.id,
                              match.team1Score,
                              match.team2Score,
                              't2',
                              1
                            )
                          }
                          style={[
                            styles.scoreBtnSm,
                            { backgroundColor: theme.colors.accentSoft },
                          ]}
                          hitSlop={4}
                        >
                          <Text
                            style={{
                              color: theme.colors.accent,
                              fontWeight: '900',
                              fontSize: 11,
                            }}
                          >
                            +
                          </Text>
                        </Pressable>
                        <Text
                          style={[
                            styles.scoreValue,
                            { color: theme.colors.text },
                          ]}
                        >
                          {s.t2}
                        </Text>
                        <Pressable
                          disabled={locked}
                          onPress={() =>
                            adjustScore(
                              match.id,
                              match.team1Score,
                              match.team2Score,
                              't2',
                              -1
                            )
                          }
                          style={[
                            styles.scoreBtnSm,
                            { backgroundColor: theme.colors.border },
                          ]}
                          hitSlop={4}
                        >
                          <Text
                            style={{
                              color: theme.colors.textMuted,
                              fontWeight: '900',
                              fontSize: 11,
                            }}
                          >
                            −
                          </Text>
                        </Pressable>
                      </View>
                      <Text
                        style={[
                          styles.td,
                          styles.colTeam,
                          styles.teamCell,
                          { color: theme.colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {teamNameById(match.team2Id)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.competitionManage.staffSection')}</Subtitle>
        {(competition.staff || []).length === 0 ? (
          <EmptyState
            title={t('organizer.competitionManage.noStaff')}
            icon="people-outline"
          />
        ) : (
          (competition.staff || []).map((member) => (
            <View
              key={member.id}
              style={[styles.refRow, { borderTopColor: theme.colors.border }]}
            >
              <Avatar uri={member.avatar} name={member.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.value, { color: theme.colors.text }]}>
                  {member.name}
                </Text>
                <Muted>{member.role}</Muted>
                <Muted>{member.mobile || '—'}</Muted>
                <Pressable
                  onPress={() =>
                    setAvatarEdit({
                      kind: 'staff',
                      id: member.id,
                      name: member.name,
                      value: member.avatar,
                    })
                  }
                  hitSlop={6}
                >
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontWeight: '700',
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {t('media.changeHandleIcon')}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('organizer.competitionManage.remove')}
                onPress={() => {
                  void (async () => {
                    const ok = await confirmDestructive({
                      title: t('organizer.competitions.removeStaffConfirmTitle'),
                      message: t('organizer.competitions.removeStaffConfirmMessage', {
                        name: member.name,
                      }),
                      cancelLabel: t('common.cancel'),
                      confirmLabel: t('common.delete'),
                    });
                    if (!ok) return;
                    removeStaffFromCompetition(
                      competition.id,
                      member.id,
                      t('organizer.competitionManage.staffRemoved', {
                        name: member.name,
                      })
                    );
                  })();
                }}
              >
                <Text
                  style={{
                    color: theme.colors.danger,
                    fontWeight: '800',
                    fontSize: 12,
                  }}
                >
                  {t('organizer.competitionManage.remove')}
                </Text>
              </Pressable>
            </View>
          ))
        )}

        <Subtitle>{t('organizer.competitionManage.addStaff')}</Subtitle>
        <Input
          label={t('organizer.competitionManage.staffName')}
          value={staffName}
          onChangeText={setStaffName}
        />
        <EntityAvatarField
          value={staffAvatar}
          name={staffName || '?'}
          folder="staff"
          onChange={setStaffAvatar}
          compact
        />
        <Input
          label={t('organizer.competitionManage.staffRole')}
          value={staffRole}
          onChangeText={setStaffRole}
          placeholder={t('organizer.competitionManage.staffRolePlaceholder')}
        />
        <Input
          label={t('organizer.competitionManage.staffMobile')}
          value={staffMobile}
          onChangeText={setStaffMobile}
          keyboardType="phone-pad"
        />
        <Button
          label={t('superadmin.actions.add')}
          onPress={() => {
            if (
              addStaffToCompetition(competition.id, {
                name: staffName,
                role: staffRole,
                mobile: staffMobile,
                avatar: staffAvatar,
              })
            ) {
              setStaffName('');
              setStaffRole('');
              setStaffMobile('');
              setStaffAvatar(undefined);
            }
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('superadmin.competitionDetail.assignedReferees')}</Subtitle>
        {assignedRefs.length === 0 ? (
          <Muted>{t('superadmin.competitionDetail.noAssignedReferees')}</Muted>
        ) : (
          assignedRefs.map((ref) => (
            <View
              key={ref.id}
              style={[styles.refRow, { borderTopColor: theme.colors.border }]}
            >
              <Avatar uri={ref.avatar} name={ref.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.value, { color: theme.colors.text }]}>
                  {ref.name}
                </Text>
                <Muted>{ref.role}</Muted>
                <Pressable
                  onPress={() =>
                    setAvatarEdit({
                      kind: 'referee',
                      id: ref.id,
                      name: ref.name,
                      value: ref.avatar,
                    })
                  }
                  hitSlop={6}
                >
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontWeight: '700',
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {t('media.changeHandleIcon')}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('organizer.competitionManage.remove')}
                onPress={() => {
                  void (async () => {
                    const ok = await confirmDestructive({
                      title: t('organizer.competitions.removeRefereeConfirmTitle'),
                      message: t('organizer.competitions.removeRefereeConfirmMessage', {
                        name: ref.name,
                      }),
                      cancelLabel: t('common.cancel'),
                      confirmLabel: t('common.delete'),
                    });
                    if (!ok) return;
                    removeRefereeFromCompetition(
                      competition.id,
                      ref.id,
                      t('organizer.competitionManage.refereeRemoved', {
                        name: ref.name,
                      })
                    );
                  })();
                }}
              >
                <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 12 }}>
                  {t('organizer.competitionManage.remove')}
                </Text>
              </Pressable>
            </View>
          ))
        )}

        <Subtitle>{t('organizer.competitionManage.addRefereeSection')}</Subtitle>
        {availableRefs.length === 0 ? (
          <Muted>{t('organizer.competitionManage.noAvailableReferees')}</Muted>
        ) : (
          availableRefs.map((ref) => (
            <View
              key={ref.id}
              style={[styles.refRow, { borderTopColor: theme.colors.border }]}
            >
              <Avatar uri={ref.avatar} name={ref.name} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.value, { color: theme.colors.text }]}>
                  {ref.name}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  assignRefereeToCompetition(
                    competition.id,
                    ref.id,
                    t('organizer.competitionManage.refereeAdded', {
                      name: ref.name,
                    })
                  )
                }
              >
                <Text style={{ color: theme.colors.accent, fontWeight: '800', fontSize: 12 }}>
                  {t('superadmin.actions.add')}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <ShareTargetModal
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />

      {avatarEdit ? (
        <EntityAvatarEditModal
          visible
          title={`${t('media.changeHandleIcon')} — ${avatarEdit.name}`}
          value={avatarEdit.value}
          name={avatarEdit.name}
          folder={
            avatarEdit.kind === 'player'
              ? 'players'
              : avatarEdit.kind === 'staff'
                ? 'staff'
                : 'referees'
          }
          onChange={(url) => {
            if (avatarEdit.kind === 'player' && avatarEdit.teamId) {
              updatePlayerAvatar(
                competition.id,
                avatarEdit.teamId,
                avatarEdit.id,
                url,
                t('media.entityPhotoUpdated')
              );
            } else if (avatarEdit.kind === 'staff') {
              updateStaffAvatar(
                competition.id,
                avatarEdit.id,
                url,
                t('media.entityPhotoUpdated')
              );
            } else if (avatarEdit.kind === 'referee') {
              const current = referees.find((r) => r.id === avatarEdit.id);
              if (current) {
                updateReferee(
                  { ...current, avatar: url },
                  t('media.entityPhotoUpdated')
                );
              }
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
  content: { paddingTop: 8, gap: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  card: { gap: 10 },
  value: { fontWeight: '800', textAlign: 'left' },
  teamRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  playerRow: {
    marginLeft: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    flex: 1,
    fontWeight: '700',
    fontSize: 13,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tableScroll: { paddingBottom: 4 },
  table: {
    minWidth: 640,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  td: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamCell: {
    fontWeight: '800',
    textAlign: 'left',
    paddingHorizontal: 4,
  },
  colNum: { width: 36 },
  colDate: { width: 96 },
  colTime: { width: 64 },
  colTeam: { width: 120 },
  colScore: { width: 148 },
  scoreCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scoreBtnSm: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '900',
    minWidth: 16,
    textAlign: 'center',
  },
  refRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useTournament,
  type Player,
  type Team,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
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
import { formatArabicDate, formatArabicTime } from '@/utils';

const POSITION_OPTIONS: {
  value: Player['position'];
  key: 'goalkeeper' | 'defense' | 'midfield' | 'attack';
}[] = [
  { value: 'حارس مرمى', key: 'goalkeeper' },
  { value: 'دفاع', key: 'defense' },
  { value: 'وسط', key: 'midfield' },
  { value: 'هجوم', key: 'attack' },
];

export default function CompetitionManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const {
    competitions,
    currentUser,
    referees,
    addTeam,
    renameCompetition,
    deleteCompetition,
    renameTeam,
    deleteTeam,
    addPlayerToTeam,
    addStaffToCompetition,
    removeStaffFromCompetition,
    generateFixturesForCompetition,
    updateMatchResult,
    assignRefereeToCompetition,
    removeRefereeFromCompetition,
  } = useTournament();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [editCompetitionName, setEditCompetitionName] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState<Player['position']>('وسط');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [staffMobile, setStaffMobile] = useState('');
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
    () => referees.filter((r) => competition?.refereeIds.includes(r.id)),
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

  const confirmDeleteCompetition = () => {
    Alert.alert(
      t('organizer.competitionManage.deleteCompetition'),
      t('organizer.competitionManage.deleteCompetitionConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('organizer.competitionManage.deleteCompetition'),
          style: 'destructive',
          onPress: () => {
            if (deleteCompetition(competition.id)) {
              router.replace('/(organizer)/competitions');
            }
          },
        },
      ]
    );
  };

  const confirmDeleteTeam = (team: Team) => {
    Alert.alert(
      t('organizer.competitionManage.deleteTeam'),
      t('organizer.competitionManage.deleteTeamConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('organizer.competitionManage.deleteTeam'),
          style: 'destructive',
          onPress: () => {
            if (deleteTeam(competition.id, team.id)) {
              if (selectedTeamId === team.id) setSelectedTeamId(null);
            }
          },
        },
      ]
    );
  };

  const renderTeam = (team: Team) => {
    const selected = selectedTeamId === team.id;
    return (
      <Pressable
        key={team.id}
        onPress={() => setSelectedTeamId(team.id)}
        style={[
          styles.teamRow,
          {
            borderColor: selected ? theme.colors.primary : theme.colors.border,
            backgroundColor: selected
              ? theme.colors.primarySoft
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
          <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 12 }}>
            {t('organizer.competitionManage.deleteTeam')}
          </Text>
        </Pressable>
      </Pressable>
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
          </>
        ) : null}

        <Subtitle>{t('organizer.competitionManage.addTeam')}</Subtitle>
        <Input
          label={t('organizer.competitionManage.teamName')}
          value={teamName}
          onChangeText={setTeamName}
          placeholder={t('organizer.competitionManage.teamNamePlaceholder')}
        />
        <Button
          label={t('superadmin.actions.add')}
          onPress={() => {
            if (!teamName.trim()) return;
            addTeam(
              competition.id,
              { name: teamName.trim() },
              t('organizer.competitionManage.teamAdded')
            );
            setTeamName('');
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
                  },
                  t('organizer.competitionManage.playerAdded')
                );
                setPlayerName('');
                setJersey('');
              }}
            />
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.competitionManage.fixtures')}</Subtitle>
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
          sortedMatches.map((match) => {
            const s = getScore(match.id, match.team1Score, match.team2Score);
            return (
              <View
                key={match.id}
                style={[styles.matchRow, { borderTopColor: theme.colors.border }]}
              >
                <Text style={[styles.value, { color: theme.colors.text }]}>
                  {teamNameById(match.team1Id)} vs {teamNameById(match.team2Id)}
                </Text>
                <Muted>
                  {formatArabicDate(match.date)} · {formatArabicTime(match.date)}
                </Muted>
                <View style={styles.scoreRow}>
                  <View style={styles.scoreSide}>
                    <Pressable
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
                        styles.scoreBtn,
                        { backgroundColor: theme.colors.primarySoft },
                      ]}
                    >
                      <Text style={{ color: theme.colors.primary, fontWeight: '900' }}>
                        +
                      </Text>
                    </Pressable>
                    <Text style={[styles.scoreNum, { color: theme.colors.text }]}>
                      {s.t1}
                    </Text>
                    <Pressable
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
                        styles.scoreBtn,
                        { backgroundColor: theme.colors.inputBg },
                      ]}
                    >
                      <Text style={{ color: theme.colors.textMuted, fontWeight: '900' }}>
                        −
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={{ color: theme.colors.textMuted, fontWeight: '800' }}>
                    -
                  </Text>
                  <View style={styles.scoreSide}>
                    <Pressable
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
                        styles.scoreBtn,
                        { backgroundColor: theme.colors.primarySoft },
                      ]}
                    >
                      <Text style={{ color: theme.colors.primary, fontWeight: '900' }}>
                        +
                      </Text>
                    </Pressable>
                    <Text style={[styles.scoreNum, { color: theme.colors.text }]}>
                      {s.t2}
                    </Text>
                    <Pressable
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
                        styles.scoreBtn,
                        { backgroundColor: theme.colors.inputBg },
                      ]}
                    >
                      <Text style={{ color: theme.colors.textMuted, fontWeight: '900' }}>
                        −
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
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
              <View style={{ flex: 1 }}>
                <Text style={[styles.value, { color: theme.colors.text }]}>
                  {member.name}
                </Text>
                <Muted>{member.role}</Muted>
                <Muted>{member.mobile || '—'}</Muted>
              </View>
              <Pressable
                onPress={() =>
                  removeStaffFromCompetition(
                    competition.id,
                    member.id,
                    t('organizer.competitionManage.staffRemoved', {
                      name: member.name,
                    })
                  )
                }
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
              })
            ) {
              setStaffName('');
              setStaffRole('');
              setStaffMobile('');
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
              </View>
              <Pressable
                onPress={() =>
                  removeRefereeFromCompetition(
                    competition.id,
                    ref.id,
                    t('organizer.competitionManage.refereeRemoved', {
                      name: ref.name,
                    })
                  )
                }
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
                <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 12 }}>
                  {t('superadmin.actions.add')}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  matchRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scoreSide: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: { fontSize: 22, fontWeight: '900', minWidth: 28, textAlign: 'center' },
  refRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
});

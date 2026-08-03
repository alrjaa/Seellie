import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useTournament,
  type Competition,
  type Player,
  type Referee,
  type Team,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ReasonModal } from '@/components/feedback/ReasonModal';
import { Avatar, Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import {
  computeStandings,
  formatVenueAddress,
} from '@/utils/competition';
import { formatArabicDate, formatArabicTime } from '@/utils';

type PendingAction =
  | {
      kind: 'competition';
      status: Competition['status'];
    }
  | {
      kind: 'player';
      teamId: string;
      playerId: string;
      playerName: string;
      status: Player['status'];
    }
  | {
      kind: 'referee';
      referee: Referee;
      status: Referee['status'];
    };

export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const {
    competitions,
    users,
    referees,
    updateCompetitionStatus,
    updatePlayerStatus,
    updateReferee,
    generateFixturesForCompetition,
    updateMatchResult,
    assignRefereeToCompetition,
    removeRefereeFromCompetition,
    addStaffToCompetition,
    removeStaffFromCompetition,
  } = useTournament();

  const [tab, setTab] = useState<
    'info' | 'fixtures' | 'standings' | 'referees'
  >('info');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [editingScores, setEditingScores] = useState<
    Record<string, { t1: string; t2: string }>
  >({});
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [staffMobile, setStaffMobile] = useState('');

  const competition = useMemo(
    () => competitions.find((c) => c.id === id),
    [competitions, id]
  );

  const organizer = useMemo(
    () => users.find((u) => u.id === competition?.organizerId),
    [users, competition]
  );

  const assignedRefs = useMemo(
    () => referees.filter((r) => competition?.refereeIds.includes(r.id)),
    [referees, competition]
  );

  const availableRefs = useMemo(
    () =>
      referees.filter((r) => !competition?.refereeIds.includes(r.id)),
    [referees, competition]
  );

  const standings = useMemo(
    () => (competition ? computeStandings(competition) : []),
    [competition]
  );

  const sortedMatches = useMemo(() => {
    if (!competition) return [];
    return [...competition.matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [competition]);

  const isNewCompetition = !!competition && competition.matches.length === 0;

  if (!competition) {
    return (
      <Screen contentStyle={styles.content} edges={['left', 'right']}>
        <EmptyState
          title={t('superadmin.competitionDetail.notFound')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
          icon="trophy-outline"
        />
      </Screen>
    );
  }

  const statusColor =
    competition.status === 'active'
      ? theme.colors.primary
      : competition.status === 'suspended'
        ? theme.colors.danger
        : theme.colors.warning;

  const teamName = (teamId: string) =>
    competition.teams.find((t) => t.id === teamId)?.name || '?';

  const confirmPending = (reason: string) => {
    if (!pending) return;

    if (pending.kind === 'competition') {
      updateCompetitionStatus(competition.id, pending.status, {
        reason,
        successMessage:
          pending.status === 'active'
            ? t('superadmin.competitionDetail.modals.activatedName', {
                name: competition.name,
              })
            : pending.status === 'warned'
              ? t('superadmin.competitionDetail.modals.warnedCompetition', {
                  name: competition.name,
                })
              : t('superadmin.competitionDetail.modals.suspendedName', {
                  name: competition.name,
                }),
      });
    }

    if (pending.kind === 'player') {
      updatePlayerStatus(
        competition.id,
        pending.teamId,
        pending.playerId,
        pending.status,
        {
          reason,
          successMessage:
            pending.status === 'active'
              ? t('superadmin.competitionDetail.modals.activatedName', {
                  name: pending.playerName,
                })
              : pending.status === 'warned'
                ? t('superadmin.competitionDetail.modals.warnedPlayer', {
                    name: pending.playerName,
                  })
                : t('superadmin.competitionDetail.modals.suspendedName', {
                    name: pending.playerName,
                  }),
        }
      );
    }

    if (pending.kind === 'referee') {
      updateReferee(
        {
          ...pending.referee,
          status: pending.status,
          statusReason:
            pending.status === 'active' ? undefined : reason.trim(),
        },
        pending.status === 'active'
          ? t('superadmin.competitionDetail.modals.activatedReferee', {
              name: pending.referee.name,
            })
          : pending.status === 'warned'
            ? t('superadmin.competitionDetail.modals.warnedReferee', {
                name: pending.referee.name,
              })
            : t('superadmin.competitionDetail.modals.suspendedReferee', {
                name: pending.referee.name,
              })
      );
    }

    setPending(null);
  };

  const modalMeta = (() => {
    if (!pending) return null;
    if (pending.kind === 'competition') {
      if (pending.status === 'active') {
        return {
          title: t('superadmin.competitionDetail.modals.activateCompetition'),
          description: t('superadmin.competitionDetail.modals.activateCompetitionDesc', {
            name: competition.name,
          }),
          requireReason: false,
          confirmLabel: t('superadmin.actions.activate'),
          destructive: false,
        };
      }
      return {
        title:
          pending.status === 'warned'
            ? t('superadmin.competitionDetail.modals.warnCompetition')
            : t('superadmin.competitionDetail.modals.suspendCompetition'),
        description:
          pending.status === 'warned'
            ? t('superadmin.competitionDetail.modals.warnCompetitionDesc')
            : t('superadmin.competitionDetail.modals.suspendCompetitionDesc'),
        requireReason: true,
        confirmLabel:
          pending.status === 'warned'
            ? t('superadmin.competitionDetail.modals.confirmWarn')
            : t('superadmin.competitionDetail.modals.confirmSuspend'),
        destructive: pending.status === 'suspended',
        reasonLabel:
          pending.status === 'warned'
            ? t('superadmin.competitionDetail.modals.warnReason')
            : t('superadmin.competitionDetail.modals.suspendReason'),
      };
    }
    if (pending.kind === 'player') {
      return {
        title:
          pending.status === 'active'
            ? t('superadmin.competitionDetail.modals.activatePlayer', {
                name: pending.playerName,
              })
            : pending.status === 'warned'
              ? t('superadmin.competitionDetail.modals.warnPlayer', {
                  name: pending.playerName,
                })
              : t('superadmin.competitionDetail.modals.suspendPlayer', {
                  name: pending.playerName,
                }),
        description:
          pending.status === 'active'
            ? t('superadmin.competitionDetail.modals.activatePlayerDesc')
            : t('superadmin.competitionDetail.modals.reasonRequired'),
        requireReason: pending.status !== 'active',
        confirmLabel: t('common.confirm'),
        destructive: pending.status === 'suspended',
        reasonLabel:
          pending.status === 'warned'
            ? t('superadmin.competitionDetail.modals.warnReason')
            : t('superadmin.competitionDetail.modals.suspendReason'),
      };
    }
    return {
      title:
        pending.status === 'active'
          ? t('superadmin.competitionDetail.modals.activateReferee', {
              name: pending.referee.name,
            })
          : pending.status === 'warned'
            ? t('superadmin.competitionDetail.modals.warnReferee', {
                name: pending.referee.name,
              })
            : t('superadmin.competitionDetail.modals.suspendReferee', {
                name: pending.referee.name,
              }),
      description:
        pending.status === 'active'
          ? t('superadmin.competitionDetail.modals.activateRefereeDesc')
          : t('superadmin.competitionDetail.modals.reasonRequired'),
      requireReason: pending.status !== 'active',
      confirmLabel: t('common.confirm'),
      destructive: pending.status === 'suspended',
      reasonLabel:
        pending.status === 'warned'
          ? t('superadmin.competitionDetail.modals.warnReason')
          : t('superadmin.competitionDetail.modals.suspendReason'),
    };
  })();

  const renderTeam = (team: Team) => {
    const expanded = expandedTeamId === team.id;
    return (
      <View
        key={team.id}
        style={[styles.staffRow, { borderTopColor: theme.colors.border }]}
      >
        <View style={styles.personRow}>
          <Avatar uri={team.logo} name={team.name} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {team.name}
            </Text>
            <Muted>
              {t('superadmin.competitionDetail.playersCount', {
                count: team.players.length,
                officials: team.officials.length,
              })}
            </Muted>
          </View>
          <Pressable
            onPress={() =>
              setExpandedTeamId((prev) => (prev === team.id ? null : team.id))
            }
            style={[
              styles.smallBtn,
              {
                backgroundColor: theme.colors.primarySoft,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 11 }}>
              {expanded
                ? t('superadmin.actions.hidePlayers')
                : t('superadmin.actions.showPlayers')}
            </Text>
          </Pressable>
        </View>

        {expanded ? (
          <View style={styles.playersBox}>
            {team.players.map((player) => {
              const color =
                player.status === 'active'
                  ? theme.colors.primary
                  : player.status === 'suspended'
                    ? theme.colors.danger
                    : theme.colors.warning;
              return (
                <View
                  key={player.id}
                  style={[
                    styles.playerCard,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBg },
                  ]}
                >
                  <View style={styles.personRow}>
                    <Avatar uri={player.avatar} name={player.name} size={34} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.value, { color: theme.colors.text }]}>
                        {player.name}
                      </Text>
                      <Muted>
                        {t('superadmin.competitionDetail.jerseyNumber', {
                          number: player.jerseyNumber,
                        })}{' '}
                        · {player.position}
                      </Muted>
                      <Text style={{ color, fontWeight: '800', fontSize: 11, textAlign: 'left' }}>
                        {t(`status.${player.status}`)}
                      </Text>
                      {player.statusReason ? (
                        <Muted>
                          {t('superadmin.competitionDetail.reasonLine', {
                            reason: player.statusReason,
                          })}
                        </Muted>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.inlineActions}>
                    <Pressable
                      onPress={() =>
                        setPending({
                          kind: 'player',
                          teamId: team.id,
                          playerId: player.id,
                          playerName: player.name,
                          status: 'active',
                        })
                      }
                    >
                      <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 11 }}>
                        {t('superadmin.actions.activate')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setPending({
                          kind: 'player',
                          teamId: team.id,
                          playerId: player.id,
                          playerName: player.name,
                          status: 'warned',
                        })
                      }
                    >
                      <Text style={{ color: theme.colors.warning, fontWeight: '800', fontSize: 11 }}>
                        {t('superadmin.actions.warn')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setPending({
                          kind: 'player',
                          teamId: team.id,
                          playerId: player.id,
                          playerName: player.name,
                          status: 'suspended',
                        })
                      }
                    >
                      <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 11 }}>
                        {t('superadmin.actions.suspend')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Avatar uri={competition.logo} name={competition.name} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Title>{competition.name}</Title>
          <Muted>{competition.visibleId}</Muted>
          <Text style={[styles.status, { color: statusColor }]}>
            {t(`superadmin.competitionStatus.${competition.status}`)}
          </Text>
          {competition.statusReason ? (
            <Muted>
              {t('superadmin.competitionDetail.reasonLine', {
                reason: competition.statusReason,
              })}
            </Muted>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={t('superadmin.actions.activate')}
          variant={competition.status === 'active' ? 'primary' : 'outline'}
          onPress={() => setPending({ kind: 'competition', status: 'active' })}
          style={{ flex: 1 }}
        />
        <Button
          label={t('superadmin.actions.warn')}
          variant={competition.status === 'warned' ? 'primary' : 'outline'}
          onPress={() => setPending({ kind: 'competition', status: 'warned' })}
          style={{ flex: 1 }}
        />
        <Button
          label={t('superadmin.actions.suspend')}
          variant={competition.status === 'suspended' ? 'danger' : 'outline'}
          onPress={() =>
            setPending({ kind: 'competition', status: 'suspended' })
          }
          style={{ flex: 1 }}
        />
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['info', t('superadmin.competitionDetail.tabs.info')],
            ['fixtures', t('superadmin.competitionDetail.tabs.fixtures')],
            ['standings', t('superadmin.competitionDetail.tabs.standings')],
            ['referees', t('superadmin.competitionDetail.tabs.referees')],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[
              styles.tab,
              {
                backgroundColor:
                  tab === key ? theme.colors.primary : theme.colors.inputBg,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color:
                  tab === key
                    ? theme.colors.textInverse
                    : theme.colors.textMuted,
                fontWeight: '800',
                fontSize: 12,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'info' ? (
        <>
          <Card style={styles.card}>
            <Subtitle>{t('superadmin.competitionDetail.venueSection')}</Subtitle>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {competition.venue?.name || t('superadmin.labels.notSet')}
            </Text>
            <Muted>{formatVenueAddress(competition)}</Muted>
            {competition.venue ? (
              <View style={styles.metaBlock}>
                <Muted>
                  {t('superadmin.competitionDetail.venueMeta.city', {
                    value: competition.venue.city || '—',
                  })}
                </Muted>
                <Muted>
                  {t('superadmin.competitionDetail.venueMeta.region', {
                    value: competition.venue.region || '—',
                  })}
                </Muted>
                <Muted>
                  {t('superadmin.competitionDetail.venueMeta.street', {
                    value: competition.venue.street || '—',
                  })}
                </Muted>
                <Muted>
                  {t('superadmin.competitionDetail.venueMeta.building', {
                    value: competition.venue.buildingNumber || '—',
                  })}
                </Muted>
                <Muted>
                  {t('superadmin.competitionDetail.venueMeta.country', {
                    value: competition.venue.country || '—',
                  })}
                </Muted>
              </View>
            ) : null}
          </Card>

          <Card style={styles.card}>
            <Subtitle>{t('superadmin.competitionDetail.organizerSection')}</Subtitle>
            {organizer ? (
              <View style={styles.personRow}>
                <Avatar uri={organizer.avatar} name={organizer.name} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.value, { color: theme.colors.text }]}>
                    {organizer.name}
                  </Text>
                  <Muted>{organizer.email}</Muted>
                  <Muted>{organizer.mobile || t('superadmin.labels.noPhone')}</Muted>
                </View>
              </View>
            ) : (
              <Muted>{t('superadmin.competitionDetail.unknownOrganizer')}</Muted>
            )}
          </Card>

          <Card style={styles.card}>
            <Subtitle>{t('superadmin.competitionDetail.staffSection')}</Subtitle>
            {(competition.staff || []).length === 0 ? (
              <EmptyState
                title={t('superadmin.competitionDetail.noStaff')}
                icon="people-outline"
              />
            ) : (
              competition.staff!.map((member) => (
                <View
                  key={member.id}
                  style={[styles.staffRow, { borderTopColor: theme.colors.border }]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
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
            <Subtitle>{t('superadmin.competitionDetail.teamsSection')}</Subtitle>
            <Muted>{t('superadmin.competitionDetail.teamsHint')}</Muted>
            {competition.teams.map(renderTeam)}
          </Card>
        </>
      ) : null}

      {tab === 'fixtures' ? (
        <>
          {isNewCompetition ? (
            <Button
              label={t('superadmin.competitionDetail.createDraw')}
              onPress={() => generateFixturesForCompetition(competition.id)}
            />
          ) : (
            <Card style={styles.card}>
              <Subtitle>{t('superadmin.competitionDetail.drawUnavailable')}</Subtitle>
              <Muted>
                {t('superadmin.competitionDetail.drawUnavailableDesc', {
                  count: competition.matches.length,
                })}
              </Muted>
            </Card>
          )}

          {sortedMatches.length === 0 ? (
            <EmptyState
              title={t('superadmin.competitionDetail.noFixtures')}
              description={t('superadmin.competitionDetail.noFixturesDesc')}
              icon="calendar-outline"
            />
          ) : (
            sortedMatches.map((match) => {
              const draft = editingScores[match.id] || {
                t1: String(match.team1Score),
                t2: String(match.team2Score),
              };
              return (
                <Card key={match.id} style={styles.card}>
                  <Text style={[styles.matchTitle, { color: theme.colors.text }]}>
                    {teamName(match.team1Id)} vs {teamName(match.team2Id)}
                  </Text>
                  <Muted>{formatArabicDate(match.date)}</Muted>
                  <Muted>{formatArabicTime(match.date)}</Muted>
                  <View style={styles.scoreRow}>
                    <TextInput
                      value={draft.t1}
                      keyboardType="number-pad"
                      onChangeText={(v) =>
                        setEditingScores((prev) => ({
                          ...prev,
                          [match.id]: {
                            ...draft,
                            t1: v.replace(/[^0-9]/g, ''),
                          },
                        }))
                      }
                      style={[
                        styles.scoreInput,
                        {
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.inputBg,
                        },
                      ]}
                    />
                    <Text style={{ color: theme.colors.textMuted, fontWeight: '800' }}>
                      -
                    </Text>
                    <TextInput
                      value={draft.t2}
                      keyboardType="number-pad"
                      onChangeText={(v) =>
                        setEditingScores((prev) => ({
                          ...prev,
                          [match.id]: {
                            ...draft,
                            t2: v.replace(/[^0-9]/g, ''),
                          },
                        }))
                      }
                      style={[
                        styles.scoreInput,
                        {
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.inputBg,
                        },
                      ]}
                    />
                    <Button
                      label={t('common.save')}
                      variant="secondary"
                      onPress={() => {
                        updateMatchResult(
                          competition.id,
                          match.id,
                          Number(draft.t1 || 0),
                          Number(draft.t2 || 0)
                        );
                        setEditingScores((prev) => {
                          const next = { ...prev };
                          delete next[match.id];
                          return next;
                        });
                      }}
                      style={{ minWidth: 72 }}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </>
      ) : null}

      {tab === 'standings' ? (
        <Card style={styles.card}>
          <Subtitle>{t('superadmin.competitionDetail.standingsTitle')}</Subtitle>
          <Muted>{t('superadmin.competitionDetail.standingsHint')}</Muted>
          <View
            style={[styles.tableHead, { borderBottomColor: theme.colors.border }]}
          >
            <Text style={[styles.th, { color: theme.colors.textMuted, flex: 1.6 }]}>
              {t('superadmin.competitionDetail.teamColumn')}
            </Text>
            <Text style={[styles.th, { color: theme.colors.textMuted }]}>
              {t('home.playedAbbr')}
            </Text>
            <Text style={[styles.th, { color: theme.colors.textMuted }]}>
              {t('home.wonAbbr')}
            </Text>
            <Text style={[styles.th, { color: theme.colors.textMuted }]}>
              {t('home.drawnAbbr')}
            </Text>
            <Text style={[styles.th, { color: theme.colors.textMuted }]}>
              {t('home.lostAbbr')}
            </Text>
            <Text style={[styles.th, { color: theme.colors.textMuted }]}>+/-</Text>
            <Text style={[styles.th, { color: theme.colors.textMuted }]}>
              {t('home.pointsAbbr')}
            </Text>
          </View>
          {standings.length === 0 ? (
            <EmptyState
              title={t('superadmin.competitionDetail.noResults')}
              icon="podium-outline"
            />
          ) : (
            standings.map((row, index) => (
              <View
                key={row.teamId}
                style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}
              >
                <Text
                  style={[
                    styles.td,
                    { color: theme.colors.text, flex: 1.6, textAlign: 'left' },
                  ]}
                  numberOfLines={1}
                >
                  {index + 1}. {row.teamName}
                </Text>
                <Text style={[styles.td, { color: theme.colors.text }]}>
                  {row.played}
                </Text>
                <Text style={[styles.td, { color: theme.colors.text }]}>
                  {row.won}
                </Text>
                <Text style={[styles.td, { color: theme.colors.text }]}>
                  {row.drawn}
                </Text>
                <Text style={[styles.td, { color: theme.colors.text }]}>
                  {row.lost}
                </Text>
                <Text style={[styles.td, { color: theme.colors.text }]}>
                  {row.goalDiff}
                </Text>
                <Text
                  style={[
                    styles.td,
                    { color: theme.colors.primary, fontWeight: '900' },
                  ]}
                >
                  {row.points}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {tab === 'referees' ? (
        <>
          <Card style={styles.card}>
            <Subtitle>{t('superadmin.competitionDetail.assignedReferees')}</Subtitle>
            {assignedRefs.length === 0 ? (
              <EmptyState
                title={t('superadmin.competitionDetail.noAssignedReferees')}
                icon="person-outline"
              />
            ) : (
              assignedRefs.map((ref) => {
                const color =
                  ref.status === 'active'
                    ? theme.colors.primary
                    : ref.status === 'suspended'
                      ? theme.colors.danger
                      : theme.colors.warning;
                return (
                  <View
                    key={ref.id}
                    style={[styles.staffRow, { borderTopColor: theme.colors.border }]}
                  >
                    <View style={styles.personRow}>
                      <Avatar uri={ref.avatar} name={ref.name} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.value, { color: theme.colors.text }]}>
                          {ref.name}
                        </Text>
                        <Muted>
                          {ref.role} ·{' '}
                          {t('superadmin.competitionDetail.ratingLine', {
                            rating: ref.rating,
                          })}
                        </Muted>
                        <Text style={{ color, fontWeight: '800', fontSize: 11, textAlign: 'left' }}>
                          {t(`status.${ref.status}`)}
                        </Text>
                        {ref.statusReason ? (
                          <Muted>
                            {t('superadmin.competitionDetail.reasonLine', {
                              reason: ref.statusReason,
                            })}
                          </Muted>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.inlineActions}>
                      <Pressable
                        onPress={() =>
                          setPending({
                            kind: 'referee',
                            referee: ref,
                            status: 'active',
                          })
                        }
                      >
                        <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 11 }}>
                          {t('superadmin.actions.activate')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setPending({
                            kind: 'referee',
                            referee: ref,
                            status: 'warned',
                          })
                        }
                      >
                        <Text style={{ color: theme.colors.warning, fontWeight: '800', fontSize: 11 }}>
                          {t('superadmin.actions.warn')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setPending({
                            kind: 'referee',
                            referee: ref,
                            status: 'suspended',
                          })
                        }
                      >
                        <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 11 }}>
                          {t('superadmin.actions.suspend')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          removeRefereeFromCompetition(
                            competition.id,
                            ref.id,
                            t('superadmin.competitionDetail.removedReferee', {
                              name: ref.name,
                            })
                          )
                        }
                      >
                        <Text style={{ color: theme.colors.textMuted, fontWeight: '800', fontSize: 11 }}>
                          {t('superadmin.actions.removeFromCompetition')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </Card>

          <Card style={styles.card}>
            <Subtitle>{t('superadmin.competitionDetail.addReferee')}</Subtitle>
            {availableRefs.length === 0 ? (
              <Muted>{t('superadmin.competitionDetail.noAvailableReferees')}</Muted>
            ) : (
              availableRefs.map((ref) => (
                <View
                  key={ref.id}
                  style={[styles.staffRow, { borderTopColor: theme.colors.border }]}
                >
                  <View style={styles.personRow}>
                    <Avatar uri={ref.avatar} name={ref.name} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.value, { color: theme.colors.text }]}>
                        {ref.name}
                      </Text>
                      <Muted>
                        {ref.role} · {t(`status.${ref.status}`)}
                      </Muted>
                    </View>
                    <Pressable
                      onPress={() =>
                        assignRefereeToCompetition(
                          competition.id,
                          ref.id,
                          t('superadmin.competitionDetail.addedReferee', {
                            name: ref.name,
                          })
                        )
                      }
                    >
                      <Text
                        style={{
                          color: theme.colors.primary,
                          fontWeight: '800',
                          fontSize: 12,
                        }}
                      >
                        {t('superadmin.actions.add')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}

      {modalMeta ? (
        <ReasonModal
          visible={!!pending}
          title={modalMeta.title}
          description={modalMeta.description}
          requireReason={modalMeta.requireReason}
          reasonLabel={modalMeta.reasonLabel}
          confirmLabel={modalMeta.confirmLabel}
          destructive={modalMeta.destructive}
          onCancel={() => setPending(null)}
          onConfirm={confirmPending}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  status: { fontWeight: '800', textAlign: 'left' },
  actions: { flexDirection: 'row', gap: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: { gap: 8 },
  value: { fontWeight: '800', textAlign: 'left' },
  metaBlock: { gap: 2 },
  personRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  staffRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 8,
  },
  smallBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  playersBox: { gap: 8 },
  playerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-end',
  },
  matchTitle: { fontWeight: '800', textAlign: 'left', fontSize: 15 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  scoreInput: {
    width: 48,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '800',
  },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 6,
    marginTop: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    alignItems: 'center',
  },
  th: { flex: 0.55, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  td: { flex: 0.55, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});

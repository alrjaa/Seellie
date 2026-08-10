import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
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
import {
  EntityAvatarField,
  EntityAvatarEditModal,
} from '@/components/account/EntityAvatarField';
import { Avatar, Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { confirmDestructive } from '@/utils/confirm';
import {
  computeStandings,
  formatVenueAddress,
} from '@/utils/competition';
import { formatArabicDate, formatArabicTime } from '@/utils';
import { statusToneColor } from '@/utils/status-tone';

type PendingAction =
  | {
      kind: 'competition';
      status: Competition['status'];
    }
  | {
      kind: 'fixtures';
      suspended: boolean;
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
    setCompetitionFixturesSuspended,
    updatePlayerStatus,
    updateReferee,
    generateFixturesForCompetition,
    updateMatchResult,
    assignRefereeToCompetition,
    removeRefereeFromCompetition,
    addStaffToCompetition,
    removeStaffFromCompetition,
    updateStaffAvatar,
    updatePlayerAvatar,
    deleteCompetition,
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
  const [staffAvatar, setStaffAvatar] = useState<string | undefined>();
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

  const statusColor = statusToneColor(theme.colors, competition.status);

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

    if (pending.kind === 'fixtures') {
      setCompetitionFixturesSuspended(competition.id, pending.suspended, {
        reason,
        successMessage: pending.suspended
          ? t('superadmin.competitionDetail.modals.fixturesSuspendedMsg', {
              name: competition.name,
            })
          : t('superadmin.competitionDetail.modals.fixturesResumedMsg', {
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
    if (pending.kind === 'fixtures') {
      return {
        title: pending.suspended
          ? t('superadmin.competitionDetail.modals.suspendFixtures')
          : t('superadmin.competitionDetail.modals.resumeFixtures'),
        description: pending.suspended
          ? t('superadmin.competitionDetail.modals.suspendFixturesDesc')
          : t('superadmin.competitionDetail.modals.resumeFixturesDesc'),
        requireReason: pending.suspended,
        confirmLabel: pending.suspended
          ? t('superadmin.competitionDetail.modals.confirmSuspendFixtures')
          : t('superadmin.competitionDetail.modals.confirmResumeFixtures'),
        destructive: pending.suspended,
        reasonLabel: t(
          'superadmin.competitionDetail.modals.fixturesSuspendReason'
        ),
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
                backgroundColor: theme.colors.accentSoft,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={{ color: theme.colors.accent, fontWeight: '800', fontSize: 11 }}>
              {expanded
                ? t('superadmin.actions.hidePlayers')
                : t('superadmin.actions.showPlayers')}
            </Text>
          </Pressable>
        </View>

        {expanded ? (
          <View style={styles.playersBox}>
            {team.players.map((player) => {
              const color = statusToneColor(theme.colors, player.status);
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
                        setAvatarEdit({
                          kind: 'player',
                          id: player.id,
                          teamId: team.id,
                          name: player.name,
                          value: player.avatar,
                        })
                      }
                    >
                      <Text style={{ color: theme.colors.accent, fontWeight: '800', fontSize: 11 }}>
                        {t('media.changeHandleIcon')}
                      </Text>
                    </Pressable>
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
                      <Text style={{ color: theme.colors.accent, fontWeight: '800', fontSize: 11 }}>
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
          style={styles.actionBtn}
        />
        <Button
          label={t('superadmin.actions.warn')}
          variant={competition.status === 'warned' ? 'primary' : 'outline'}
          onPress={() => setPending({ kind: 'competition', status: 'warned' })}
          style={styles.actionBtn}
        />
        <Button
          label={t('superadmin.actions.suspend')}
          variant={competition.status === 'suspended' ? 'danger' : 'outline'}
          onPress={() =>
            setPending({ kind: 'competition', status: 'suspended' })
          }
          style={styles.actionBtn}
        />
        <Button
          label={t('organizer.competitionManage.deleteCompetition')}
          variant="danger"
          onPress={() => {
            void (async () => {
              const ok = await confirmDestructive({
                title: t('organizer.competitionManage.deleteCompetition'),
                message: t(
                  'organizer.competitionManage.deleteCompetitionConfirm'
                ),
                cancelLabel: t('common.cancel'),
                confirmLabel: t(
                  'organizer.competitionManage.deleteCompetition'
                ),
              });
              if (!ok) return;
              if (await deleteCompetition(competition.id)) {
                router.replace('/(superadmin)/competitions' as any);
              }
            })();
          }}
          style={styles.actionBtn}
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
                  tab === key ? theme.colors.accent : theme.colors.inputBg,
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
                  <View style={styles.personRow}>
                    <Avatar uri={member.avatar} name={member.name} size={36} />
                    <View style={{ flex: 1, gap: 2 }}>
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
                            marginTop: 2,
                          }}
                        >
                          {t('media.changeHandleIcon')}
                        </Text>
                      </Pressable>
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
            <Subtitle>{t('superadmin.competitionDetail.teamsSection')}</Subtitle>
            <Muted>{t('superadmin.competitionDetail.teamsHint')}</Muted>
            {competition.teams.map(renderTeam)}
          </Card>
        </>
      ) : null}

      {tab === 'fixtures' ? (
        <>
          <Card style={styles.card}>
            <Subtitle>
              {t('superadmin.competitionDetail.fixturesTableTitle')}
            </Subtitle>
            <Muted>{t('superadmin.competitionDetail.fixturesTableHint')}</Muted>
            <Text
              style={[
                styles.status,
                {
                  color: competition.fixturesSuspended
                    ? theme.colors.danger
                    : theme.colors.accent,
                },
              ]}
            >
              {competition.fixturesSuspended
                ? t('superadmin.competitionDetail.fixturesSuspendedBadge')
                : t('superadmin.competitionDetail.fixturesActive')}
            </Text>
            {competition.fixturesSuspended &&
            competition.fixturesSuspendReason ? (
              <Muted>
                {t('superadmin.competitionDetail.fixturesSuspendReasonLine', {
                  reason: competition.fixturesSuspendReason,
                })}
              </Muted>
            ) : null}
            <View style={styles.actions}>
              {competition.fixturesSuspended ? (
                <Button
                  label={t('superadmin.competitionDetail.resumeFixtures')}
                  onPress={() =>
                    setPending({ kind: 'fixtures', suspended: false })
                  }
                  style={{ flex: 1 }}
                />
              ) : (
                <Button
                  label={t('superadmin.competitionDetail.suspendFixtures')}
                  variant="danger"
                  onPress={() =>
                    setPending({ kind: 'fixtures', suspended: true })
                  }
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </Card>

          {isNewCompetition ? (
            <Button
              label={t('superadmin.competitionDetail.createDraw')}
              onPress={() => generateFixturesForCompetition(competition.id)}
              disabled={!!competition.fixturesSuspended}
            />
          ) : (
            <Card style={styles.card}>
              <Subtitle>
                {t('superadmin.competitionDetail.drawUnavailable')}
              </Subtitle>
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
            <Card style={styles.card}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.fixturesScroll}
              >
                <View style={styles.fixturesTable}>
                  <View
                    style={[
                      styles.fixturesHead,
                      {
                        backgroundColor: theme.colors.accentSoft,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fTh,
                        styles.fColNum,
                        { color: theme.colors.accent },
                      ]}
                    >
                      {t('superadmin.competitionDetail.colNum')}
                    </Text>
                    <Text
                      style={[
                        styles.fTh,
                        styles.fColDate,
                        { color: theme.colors.accent },
                      ]}
                    >
                      {t('superadmin.competitionDetail.colDate')}
                    </Text>
                    <Text
                      style={[
                        styles.fTh,
                        styles.fColTime,
                        { color: theme.colors.accent },
                      ]}
                    >
                      {t('superadmin.competitionDetail.colTime')}
                    </Text>
                    <Text
                      style={[
                        styles.fTh,
                        styles.fColTeam,
                        { color: theme.colors.accent },
                      ]}
                    >
                      {t('superadmin.competitionDetail.colHome')}
                    </Text>
                    <Text
                      style={[
                        styles.fTh,
                        styles.fColScore,
                        { color: theme.colors.accent },
                      ]}
                    >
                      {t('superadmin.competitionDetail.colScore')}
                    </Text>
                    <Text
                      style={[
                        styles.fTh,
                        styles.fColTeam,
                        { color: theme.colors.accent },
                      ]}
                    >
                      {t('superadmin.competitionDetail.colAway')}
                    </Text>
                  </View>

                  {sortedMatches.map((match, index) => {
                    const draft = editingScores[match.id] || {
                      t1: String(match.team1Score),
                      t2: String(match.team2Score),
                    };
                    const zebra =
                      index % 2 === 0
                        ? theme.colors.card
                        : theme.colors.inputBg;
                    return (
                      <View
                        key={match.id}
                        style={[
                          styles.fixturesRow,
                          {
                            backgroundColor: zebra,
                            borderColor: theme.colors.border,
                            opacity: competition.fixturesSuspended ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.fTd,
                            styles.fColNum,
                            { color: theme.colors.textMuted },
                          ]}
                        >
                          {index + 1}
                        </Text>
                        <Text
                          style={[
                            styles.fTd,
                            styles.fColDate,
                            { color: theme.colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {formatArabicDate(match.date)}
                        </Text>
                        <Text
                          style={[
                            styles.fTd,
                            styles.fColTime,
                            { color: theme.colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {formatArabicTime(match.date)}
                        </Text>
                        <Text
                          style={[
                            styles.fTd,
                            styles.fColTeam,
                            styles.fTeam,
                            { color: theme.colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {teamName(match.team1Id)}
                        </Text>
                        <View style={[styles.fColScore, styles.fScoreCell]}>
                          <TextInput
                            value={draft.t1}
                            editable={!competition.fixturesSuspended}
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
                              styles.scoreInputSm,
                              {
                                color: theme.colors.text,
                                borderColor: theme.colors.border,
                                backgroundColor: theme.colors.inputBg,
                              },
                            ]}
                          />
                          <Text
                            style={{
                              color: theme.colors.textMuted,
                              fontWeight: '800',
                            }}
                          >
                            :
                          </Text>
                          <TextInput
                            value={draft.t2}
                            editable={!competition.fixturesSuspended}
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
                              styles.scoreInputSm,
                              {
                                color: theme.colors.text,
                                borderColor: theme.colors.border,
                                backgroundColor: theme.colors.inputBg,
                              },
                            ]}
                          />
                          <Pressable
                            disabled={!!competition.fixturesSuspended}
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
                            style={[
                              styles.saveScoreBtn,
                              {
                                backgroundColor: competition.fixturesSuspended
                                  ? theme.colors.border
                                  : theme.colors.accentSoft,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: theme.colors.accent,
                                fontWeight: '800',
                                fontSize: 11,
                              }}
                            >
                              {t('common.save')}
                            </Text>
                          </Pressable>
                        </View>
                        <Text
                          style={[
                            styles.fTd,
                            styles.fColTeam,
                            styles.fTeam,
                            { color: theme.colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {teamName(match.team2Id)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </Card>
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
                    { color: theme.colors.accent, fontWeight: '900' },
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
                    ? theme.colors.accent
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
                          setAvatarEdit({
                            kind: 'referee',
                            id: ref.id,
                            name: ref.name,
                            value: ref.avatar,
                          })
                        }
                      >
                        <Text style={{ color: theme.colors.accent, fontWeight: '800', fontSize: 11 }}>
                          {t('media.changeHandleIcon')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setPending({
                            kind: 'referee',
                            referee: ref,
                            status: 'active',
                          })
                        }
                      >
                        <Text style={{ color: theme.colors.accent, fontWeight: '800', fontSize: 11 }}>
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
                          color: theme.colors.accent,
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
  status: { fontWeight: '800', textAlign: 'left' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'stretch',
  },
  actionBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 88,
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
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
  fixturesScroll: { paddingBottom: 4 },
  fixturesTable: { minWidth: 680 },
  fixturesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  fixturesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  fTh: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  fTd: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  fTeam: { fontWeight: '800', textAlign: 'left', paddingHorizontal: 4 },
  fColNum: { width: 36 },
  fColDate: { width: 96 },
  fColTime: { width: 64 },
  fColTeam: { width: 120 },
  fColScore: { width: 168 },
  fScoreCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scoreInputSm: {
    width: 36,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 12,
  },
  saveScoreBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
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

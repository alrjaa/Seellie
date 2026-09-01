import React, { memo, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, Muted, Subtitle } from '@/components/ui';
import { useSportsFixtureDetail } from '@/hooks/useSportsFixtureDetail';
import { formatArabicDate, formatArabicTime } from '@/utils';
import { cairoText } from '@/theme/fonts';
import type {
  SportsFixtureDetail,
  SportsLineupPlayer,
  SportsMatchEvent,
  SportsTeamLineup,
} from '@/services/sports-data';

type TabKey = 'overview' | 'events' | 'stats';

function isFinished(status: string) {
  const s = status.toUpperCase();
  return s === 'FT' || s === 'AET' || s === 'PEN' || s === 'AWD' || s === 'WO';
}

function isLive(status: string) {
  const s = status.toUpperCase();
  return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s);
}

function scoreText(d: SportsFixtureDetail) {
  if (d.homeScore == null || d.awayScore == null) return 'vs';
  return `${d.homeScore} - ${d.awayScore}`;
}

function goalEvents(d: SportsFixtureDetail, side: 'home' | 'away') {
  return d.events.filter(
    (e) =>
      e.teamSide === side &&
      (e.type === 'Goal' || e.detail?.toLowerCase().includes('goal'))
  );
}

function eventMinute(e: SportsMatchEvent) {
  if (e.extraMinute && e.extraMinute > 0) {
    return `${e.minute}+${e.extraMinute}'`;
  }
  return `${e.minute}'`;
}

const MatchHeader = memo(function MatchHeader({
  detail,
}: {
  detail: SportsFixtureDetail;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const homeGoals = goalEvents(detail, 'home');
  const awayGoals = goalEvents(detail, 'away');

  return (
    <Card style={styles.headerCard}>
      <Text style={[styles.leagueLine, { color: theme.colors.textMuted }]}>
        {detail.leagueName || t('sportsFixture.league')}
        {detail.round ? ` · ${detail.round}` : ''}
      </Text>
      <Text style={[styles.statusLine, { color: theme.colors.accent }]}>
        {isLive(detail.status)
          ? `${t('sportsFixture.live')}${detail.elapsed != null ? ` · ${detail.elapsed}'` : ''}`
          : isFinished(detail.status)
            ? t('sportsFixture.finished')
            : detail.status || t('sportsFixture.scheduled')}
      </Text>
      <View style={styles.scoreBoard}>
        <View style={styles.teamCol}>
          <Avatar uri={detail.homeLogo} name={detail.homeName} size={56} />
          <Text
            style={[styles.teamName, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {detail.homeName}
          </Text>
          {homeGoals.map((g) => (
            <Text
              key={g.id}
              style={[styles.scorer, { color: theme.colors.textMuted }]}
              numberOfLines={1}
            >
              {g.playerName || '—'} {eventMinute(g)}
            </Text>
          ))}
        </View>
        <Text style={[styles.bigScore, { color: theme.colors.text }]}>
          {scoreText(detail)}
        </Text>
        <View style={styles.teamCol}>
          <Avatar uri={detail.awayLogo} name={detail.awayName} size={56} />
          <Text
            style={[styles.teamName, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {detail.awayName}
          </Text>
          {awayGoals.map((g) => (
            <Text
              key={g.id}
              style={[styles.scorer, { color: theme.colors.textMuted }]}
              numberOfLines={1}
            >
              {g.playerName || '—'} {eventMinute(g)}
            </Text>
          ))}
        </View>
      </View>
      <Muted style={styles.metaLine}>
        {detail.date
          ? `${formatArabicDate(detail.date)} · ${formatArabicTime(detail.date)}`
          : ''}
        {detail.venue ? ` · ${detail.venue}` : ''}
        {detail.city ? `, ${detail.city}` : ''}
      </Muted>
    </Card>
  );
});

const EventsTab = memo(function EventsTab({
  events,
}: {
  events: SportsMatchEvent[];
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  if (!events.length) {
    return (
      <EmptyState
        title={t('sportsFixture.noEvents')}
        description={t('sportsFixture.noEventsDesc')}
      />
    );
  }
  return (
    <Card style={styles.sectionCard}>
      {events.map((e) => (
        <View
          key={e.id}
          style={[styles.eventRow, { borderBottomColor: theme.colors.border }]}
        >
          <Text style={[styles.eventMin, { color: theme.colors.accent }]}>
            {eventMinute(e)}
          </Text>
          <View style={styles.eventBody}>
            <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
              {e.type}
              {e.detail ? ` · ${e.detail}` : ''}
            </Text>
            <Muted>
              {e.playerName || '—'}
              {e.assistName ? ` (${e.assistName})` : ''}
            </Muted>
            <Muted>{e.teamName}</Muted>
          </View>
        </View>
      ))}
    </Card>
  );
});

function parseGrid(grid?: string) {
  if (!grid) return null;
  const [row, col] = grid.split(':').map(Number);
  if (!row || !col) return null;
  return { row, col };
}

type PitchPos = { top: number; left: number };

function buildPitchLayout(
  players: SportsLineupPlayer[],
  side: 'home' | 'away'
): Map<number, PitchPos> {
  const byRow = new Map<number, SportsLineupPlayer[]>();
  for (const p of players) {
    const row = parseGrid(p.grid)?.row ?? 5;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row)!.push(p);
  }

  const rows = [...byRow.keys()].sort((a, b) =>
    side === 'away' ? a - b : b - a
  );
  const positions = new Map<number, PitchPos>();
  const rowCount = Math.max(rows.length, 1);

  rows.forEach((rowKey, rowIdx) => {
    const rowPlayers = [...(byRow.get(rowKey) ?? [])].sort(
      (a, b) =>
        (parseGrid(a.grid)?.col ?? 0) - (parseGrid(b.grid)?.col ?? 0)
    );
    const top =
      side === 'away'
        ? 7 + (rowIdx / Math.max(rowCount - 1, 1)) * 38
        : 93 - (rowIdx / Math.max(rowCount - 1, 1)) * 38;

    rowPlayers.forEach((p, i) => {
      const left = ((i + 1) / (rowPlayers.length + 1)) * 88 + 6;
      positions.set(p.id, { top, left });
    });
  });

  return positions;
}

function ratingColor(rating: number) {
  if (rating >= 8) return '#0d6b32';
  if (rating >= 7.5) return '#1f8a3f';
  if (rating >= 7) return '#3aa655';
  if (rating >= 6.5) return '#8fb31a';
  if (rating >= 6) return '#c9a227';
  if (rating >= 5.5) return '#d97b1c';
  return '#c0392b';
}

function formatRating(rating: number) {
  return rating >= 10 ? '10' : rating.toFixed(1);
}

function displayName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return parts[parts.length - 1];
}

const PitchPlayer = memo(function PitchPlayer({
  player,
  position,
}: {
  player: SportsLineupPlayer;
  position: PitchPos;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <View
      style={[
        styles.pitchPlayerAbs,
        { top: `${position.top}%`, left: `${position.left}%` },
      ]}
    >
      <View style={styles.pitchPhotoWrap}>
        {player.photo && !photoFailed ? (
          <Image
            source={{ uri: player.photo }}
            style={styles.pitchPhoto}
            contentFit="cover"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <View style={[styles.pitchPhoto, styles.pitchPhotoFallback]}>
            <Ionicons name="person" size={22} color="rgba(255,255,255,0.7)" />
          </View>
        )}

        {player.rating != null && player.rating > 0 ? (
          <View
            style={[
              styles.ratingBadge,
              { backgroundColor: ratingColor(player.rating) },
            ]}
          >
            <Text style={styles.ratingText}>
              {formatRating(player.rating)}
            </Text>
          </View>
        ) : null}

        <View style={styles.eventBadges}>
          {(player.goals ?? 0) > 0 ? (
            <View style={styles.eventBadge}>
              <Ionicons name="football" size={9} color="#fff" />
              {(player.goals ?? 0) > 1 ? (
                <Text style={styles.eventBadgeCount}>{player.goals}</Text>
              ) : null}
            </View>
          ) : null}
          {(player.assists ?? 0) > 0 ? (
            <View style={[styles.eventBadge, styles.assistBadge]}>
              <Ionicons name="footsteps" size={9} color="#fff" />
              {(player.assists ?? 0) > 1 ? (
                <Text style={styles.eventBadgeCount}>{player.assists}</Text>
              ) : null}
            </View>
          ) : null}
          {player.substitutedOut ? (
            <View style={[styles.eventBadge, styles.subBadge]}>
              <Ionicons name="arrow-down" size={10} color="#fff" />
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.pitchLabel} numberOfLines={1}>
        {displayName(player.name)}
        {player.number != null ? ` ${player.number}` : ''}
      </Text>
    </View>
  );
});

const FootballPitchLineups = memo(function FootballPitchLineups({
  detail,
  home,
  away,
}: {
  detail: SportsFixtureDetail;
  home?: SportsTeamLineup;
  away?: SportsTeamLineup;
}) {
  const { t } = useTranslation();

  if (!home?.startXI?.length && !away?.startXI?.length) {
    return (
      <Card style={styles.sectionCard}>
        <Muted style={styles.pad}>{t('sportsFixture.noLineup')}</Muted>
      </Card>
    );
  }

  const homeXi = home?.startXI ?? [];
  const awayXi = away?.startXI ?? [];
  const homePos = buildPitchLayout(homeXi, 'home');
  const awayPos = buildPitchLayout(awayXi, 'away');
  const statusLabel = isLive(detail.status)
    ? t('sportsFixture.live')
    : isFinished(detail.status)
      ? t('sportsFixture.finished')
      : detail.status || t('sportsFixture.scheduled');

  return (
    <Card style={styles.pitchCard}>
      <View style={styles.pitchWrap}>
        <View style={styles.pitchField}>
          <View style={styles.pitchGrassStripeA} />
          <View style={styles.pitchGrassStripeB} />
          <View style={styles.pitchHalfLine} />
          <View style={styles.pitchCenterCircle} />
          <View style={styles.pitchBoxTop} />
          <View style={styles.pitchBoxBottom} />
          <View style={styles.pitchGoalTop} />
          <View style={styles.pitchGoalBottom} />

          <View style={styles.pitchScoreBar}>
            <Avatar uri={detail.homeLogo} name={detail.homeName} size={20} />
            <Text style={styles.pitchScoreText}>{scoreText(detail)}</Text>
            <Text style={styles.pitchStatusText}>{statusLabel}</Text>
            <Avatar uri={detail.awayLogo} name={detail.awayName} size={20} />
          </View>

          {awayXi.map((p) => {
            const pos = awayPos.get(p.id);
            if (!pos) return null;
            return (
              <PitchPlayer key={`away-${p.id}`} player={p} position={pos} />
            );
          })}
          {homeXi.map((p) => {
            const pos = homePos.get(p.id);
            if (!pos) return null;
            return (
              <PitchPlayer key={`home-${p.id}`} player={p} position={pos} />
            );
          })}
        </View>
      </View>

      {(home?.formation || away?.formation) ? (
        <View style={styles.formationRow}>
          <Muted>
            {away?.teamName}
            {away?.formation ? ` · ${away.formation}` : ''}
          </Muted>
          <Muted>
            {home?.teamName}
            {home?.formation ? ` · ${home.formation}` : ''}
          </Muted>
        </View>
      ) : null}

      {(home?.substitutes.length || away?.substitutes.length) ? (
        <View style={styles.subsRow}>
          {away?.substitutes.length ? (
            <View style={styles.subsCol}>
              <Subtitle style={styles.subsTitle}>
                {away.teamName} · {t('sportsFixture.substitutes')}
              </Subtitle>
              {away.substitutes.map((p) => (
                <Text key={`asub-${p.id}`} style={styles.subRow}>
                  {p.number != null ? `${p.number} ` : ''}
                  {p.name}
                </Text>
              ))}
            </View>
          ) : null}
          {home?.substitutes.length ? (
            <View style={styles.subsCol}>
              <Subtitle style={styles.subsTitle}>
                {home.teamName} · {t('sportsFixture.substitutes')}
              </Subtitle>
              {home.substitutes.map((p) => (
                <Text key={`hsub-${p.id}`} style={styles.subRow}>
                  {p.number != null ? `${p.number} ` : ''}
                  {p.name}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});

const StatsTab = memo(function StatsTab({
  detail,
}: {
  detail: SportsFixtureDetail;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  if (!detail.statistics.length) {
    return (
      <EmptyState
        title={t('sportsFixture.noStats')}
        description={t('sportsFixture.noStatsDesc')}
      />
    );
  }
  return (
    <Card style={styles.sectionCard}>
      {detail.statistics.map((row) => {
        const h = parseFloat(String(row.home).replace('%', '')) || 0;
        const a = parseFloat(String(row.away).replace('%', '')) || 0;
        const total = h + a || 1;
        const homePct = Math.round((h / total) * 100);
        const awayPct = 100 - homePct;
        return (
          <View
            key={row.type}
            style={[styles.statRow, { borderBottomColor: theme.colors.border }]}
          >
            <Text style={[styles.statVal, { color: theme.colors.text }]}>
              {row.home}
            </Text>
            <View style={styles.statMid}>
              <Text
                style={[styles.statLabel, { color: theme.colors.textMuted }]}
                numberOfLines={2}
              >
                {row.type}
              </Text>
              <View style={styles.statBarTrack}>
                <View
                  style={[
                    styles.statBarHome,
                    {
                      width: `${homePct}%`,
                      backgroundColor: theme.colors.accent,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.statBarAway,
                    {
                      width: `${awayPct}%`,
                      backgroundColor: theme.colors.border,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={[styles.statVal, { color: theme.colors.text }]}>
              {row.away}
            </Text>
          </View>
        );
      })}
    </Card>
  );
});

export default function SportsFixtureDetailScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { loading, detail, error, reload } = useSportsFixtureDetail(id);
  const [tab, setTab] = useState<TabKey>('overview');

  const tabs = useMemo(
    () =>
      [
        { key: 'overview' as const, label: t('sportsFixture.tabOverview') },
        { key: 'events' as const, label: t('sportsFixture.tabEvents') },
        { key: 'stats' as const, label: t('sportsFixture.tabStats') },
      ] as const,
    [t]
  );

  if (loading) {
    return (
      <Screen title={t('sportsFixture.title')} scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!detail || error) {
    return (
      <Screen title={t('sportsFixture.title')} scroll={false}>
        <EmptyState
          title={t('sportsFixture.notFound')}
          description={t('sportsFixture.notFoundDesc')}
          actionLabel={t('common.retry')}
          onAction={reload}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t('sportsFixture.title')} scroll={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <MatchHeader detail={detail} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: active
                      ? theme.colors.accent
                      : theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    cairoText('semiBold'),
                    {
                      color: active
                        ? theme.colors.textInverse
                        : theme.colors.text,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tab === 'overview' ? (
          <>
            <FootballPitchLineups
              detail={detail}
              home={detail.lineups.home}
              away={detail.lineups.away}
            />
            <EventsTab events={detail.events.slice(0, 8)} />
            {detail.statistics.length > 0 ? (
              <StatsTab detail={detail} />
            ) : null}
          </>
        ) : null}
        {tab === 'events' ? <EventsTab events={detail.events} /> : null}
        {tab === 'stats' ? <StatsTab detail={detail} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: { padding: 16, gap: 8 },
  leagueLine: { fontSize: 13, textAlign: 'center' },
  statusLine: { fontSize: 12, textAlign: 'center', ...cairoText('semiBold') },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  teamCol: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: {
    fontSize: 14,
    textAlign: 'center',
    ...cairoText('semiBold'),
  },
  scorer: { fontSize: 11, textAlign: 'center' },
  bigScore: {
    fontSize: 34,
    ...cairoText('bold'),
    minWidth: 88,
    textAlign: 'center',
    marginTop: 12,
  },
  metaLine: { textAlign: 'center', marginTop: 4 },
  tabsRow: { gap: 8, paddingVertical: 4 },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabText: { fontSize: 13 },
  sectionCard: { padding: 12, gap: 8 },
  eventRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventMin: { width: 42, ...cairoText('semiBold') },
  eventBody: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 14, ...cairoText('semiBold') },
  pitchCard: { padding: 0, overflow: 'hidden' },
  pitchWrap: { overflow: 'hidden' },
  pitchField: {
    aspectRatio: 0.58,
    backgroundColor: '#1f5f35',
    position: 'relative',
  },
  pitchGrassStripeA: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1f5f35',
  },
  pitchGrassStripeB: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: '50%',
    backgroundColor: '#22643a',
    opacity: 0.55,
  },
  pitchHalfLine: {
    position: 'absolute',
    top: '50%',
    left: '3%',
    right: '3%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginTop: -1,
    zIndex: 1,
  },
  pitchCenterCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '24%',
    aspectRatio: 1,
    marginTop: '-12%',
    marginLeft: '-12%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    zIndex: 1,
  },
  pitchBoxTop: {
    position: 'absolute',
    top: 0,
    left: '20%',
    width: '60%',
    height: '18%',
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.4)',
    zIndex: 1,
  },
  pitchBoxBottom: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    width: '60%',
    height: '18%',
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.4)',
    zIndex: 1,
  },
  pitchGoalTop: {
    position: 'absolute',
    top: 0,
    left: '34%',
    width: '32%',
    height: '7%',
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 1,
  },
  pitchGoalBottom: {
    position: 'absolute',
    bottom: 0,
    left: '34%',
    width: '32%',
    height: '7%',
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 1,
  },
  pitchScoreBar: {
    position: 'absolute',
    top: 10,
    left: '8%',
    right: '8%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 3,
  },
  pitchScoreText: {
    color: '#fff',
    fontSize: 15,
    ...cairoText('bold'),
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pitchStatusText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    ...cairoText('semiBold'),
  },
  pitchPlayerAbs: {
    position: 'absolute',
    width: 62,
    marginLeft: -31,
    marginTop: -30,
    alignItems: 'center',
    zIndex: 4,
  },
  pitchPhotoWrap: {
    width: 44,
    height: 44,
    position: 'relative',
  },
  pitchPhoto: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: '#3a3a3a',
  },
  pitchPhotoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    left: -6,
    minWidth: 22,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  ratingText: {
    color: '#fff',
    fontSize: 9,
    ...cairoText('bold'),
  },
  eventBadges: {
    position: 'absolute',
    top: -2,
    right: -8,
    gap: 2,
    alignItems: 'center',
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 1,
    gap: 1,
  },
  assistBadge: { backgroundColor: 'rgba(30,90,160,0.85)' },
  subBadge: { backgroundColor: 'rgba(192,57,43,0.9)' },
  eventBadgeCount: {
    color: '#fff',
    fontSize: 8,
    ...cairoText('bold'),
  },
  pitchLabel: {
    marginTop: 3,
    fontSize: 10,
    textAlign: 'center',
    maxWidth: 62,
    color: '#fff',
    ...cairoText('semiBold'),
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  formationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  subsRow: { flexDirection: 'row', gap: 12, marginTop: 10, padding: 12, paddingTop: 0 },
  subsCol: { flex: 1, gap: 4 },
  subsTitle: { marginBottom: 4, fontSize: 12 },
  subRow: { fontSize: 12, color: '#ccc' },
  pad: { padding: 12 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statVal: { width: 44, textAlign: 'center', fontSize: 13, ...cairoText('semiBold') },
  statMid: { flex: 1, gap: 6 },
  statLabel: { fontSize: 12, textAlign: 'center' },
  statBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  statBarHome: { height: '100%' },
  statBarAway: { height: '100%' },
});

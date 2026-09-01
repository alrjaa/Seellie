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

function gridExtents(players: SportsLineupPlayer[]) {
  let maxRow = 1;
  let maxCol = 1;
  for (const p of players) {
    const g = parseGrid(p.grid);
    if (!g) continue;
    maxRow = Math.max(maxRow, g.row);
    maxCol = Math.max(maxCol, g.col);
  }
  return { maxRow, maxCol };
}

function pitchCoords(
  grid: string | undefined,
  side: 'home' | 'away',
  maxRow: number,
  maxCol: number
) {
  const g = parseGrid(grid) ?? { row: 1, col: Math.ceil((maxCol + 1) / 2) };
  const left = (g.col / (maxCol + 1)) * 88 + 6;
  const rowSpan = Math.max(maxRow - 1, 1);
  const top =
    side === 'home'
      ? 92 - ((g.row - 1) / rowSpan) * 40
      : 8 + ((g.row - 1) / rowSpan) * 40;
  return { top: `${top}%`, left: `${left}%` };
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.slice(0, 10);
  return parts[parts.length - 1].slice(0, 12);
}

const PitchPlayer = memo(function PitchPlayer({
  player,
  side,
  maxRow,
  maxCol,
}: {
  player: SportsLineupPlayer;
  side: 'home' | 'away';
  maxRow: number;
  maxCol: number;
}) {
  const theme = useAppTheme();
  const pos = pitchCoords(player.grid, side, maxRow, maxCol);
  const ring =
    side === 'home' ? theme.colors.accent : theme.colors.textInverse;

  return (
    <View
      style={[
        styles.pitchPlayerAbs,
        { top: pos.top as `${number}%`, left: pos.left as `${number}%` },
      ]}
    >
      {player.photo ? (
        <Image source={{ uri: player.photo }} style={styles.pitchAvatar} />
      ) : (
        <View
          style={[
            styles.pitchAvatar,
            styles.pitchAvatarFallback,
            { borderColor: ring, backgroundColor: theme.colors.surface },
          ]}
        >
          <Text style={[styles.pitchNum, { color: theme.colors.text }]}>
            {player.number ?? '?'}
          </Text>
        </View>
      )}
      <Text
        style={[styles.pitchName, { color: theme.colors.textInverse }]}
        numberOfLines={1}
      >
        {shortName(player.name)}
      </Text>
    </View>
  );
});

const FootballPitchLineups = memo(function FootballPitchLineups({
  home,
  away,
}: {
  home?: SportsTeamLineup;
  away?: SportsTeamLineup;
}) {
  const theme = useAppTheme();
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
  const homeExt = gridExtents(homeXi);
  const awayExt = gridExtents(awayXi);

  return (
    <Card style={styles.sectionCard}>
      <View style={styles.pitchHeader}>
        <View style={styles.pitchTeamBadge}>
          <Avatar uri={away?.teamLogo} name={away?.teamName ?? '—'} size={22} />
          <Text
            style={[styles.pitchTeamLabel, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {away?.teamName ?? '—'}
            {away?.formation ? ` (${away.formation})` : ''}
          </Text>
        </View>
        <Subtitle>{t('sportsFixture.tabLineups')}</Subtitle>
        <View style={styles.pitchTeamBadge}>
          <Avatar uri={home?.teamLogo} name={home?.teamName ?? '—'} size={22} />
          <Text
            style={[styles.pitchTeamLabel, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {home?.teamName ?? '—'}
            {home?.formation ? ` (${home.formation})` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.pitchWrap}>
        <View style={styles.pitchField}>
          <View style={styles.pitchHalfLine} />
          <View style={styles.pitchCenterCircle} />
          <View style={styles.pitchBoxTop} />
          <View style={styles.pitchBoxBottom} />
          {awayXi.map((p) => (
            <PitchPlayer
              key={`away-${p.id}-${p.number}`}
              player={p}
              side="away"
              maxRow={awayExt.maxRow}
              maxCol={awayExt.maxCol}
            />
          ))}
          {homeXi.map((p) => (
            <PitchPlayer
              key={`home-${p.id}-${p.number}`}
              player={p}
              side="home"
              maxRow={homeExt.maxRow}
              maxCol={homeExt.maxCol}
            />
          ))}
        </View>
      </View>

      {(home?.substitutes.length || away?.substitutes.length) ? (
        <View style={styles.subsRow}>
          {away?.substitutes.length ? (
            <View style={styles.subsCol}>
              <Subtitle style={styles.subsTitle}>
                {away.teamName} · {t('sportsFixture.substitutes')}
              </Subtitle>
              {away.substitutes.map((p) => (
                <Text
                  key={`asub-${p.id}`}
                  style={[styles.subRow, { color: theme.colors.text }]}
                >
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
                <Text
                  key={`hsub-${p.id}`}
                  style={[styles.subRow, { color: theme.colors.text }]}
                >
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
  pitchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  pitchTeamBadge: { flex: 1, alignItems: 'center', gap: 4 },
  pitchTeamLabel: { fontSize: 11, textAlign: 'center', ...cairoText('semiBold') },
  pitchWrap: { borderRadius: 12, overflow: 'hidden' },
  pitchField: {
    aspectRatio: 0.62,
    backgroundColor: '#2d6a3e',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  pitchHalfLine: {
    position: 'absolute',
    top: '50%',
    left: '4%',
    right: '4%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginTop: -1,
  },
  pitchCenterCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '22%',
    aspectRatio: 1,
    marginTop: '-11%',
    marginLeft: '-11%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  pitchBoxTop: {
    position: 'absolute',
    top: 0,
    left: '22%',
    width: '56%',
    height: '16%',
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  pitchBoxBottom: {
    position: 'absolute',
    bottom: 0,
    left: '22%',
    width: '56%',
    height: '16%',
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  pitchPlayerAbs: {
    position: 'absolute',
    width: 56,
    marginLeft: -28,
    marginTop: -24,
    alignItems: 'center',
    gap: 2,
    zIndex: 2,
  },
  pitchAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pitchAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitchNum: { fontSize: 12, ...cairoText('bold') },
  pitchName: {
    fontSize: 9,
    textAlign: 'center',
    maxWidth: 54,
    ...cairoText('semiBold'),
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subsRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  subsCol: { flex: 1, gap: 4 },
  subsTitle: { marginBottom: 4, fontSize: 12 },
  subRow: { fontSize: 12 },
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

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

type TabKey = 'overview' | 'events' | 'lineups' | 'stats';

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

function sortByGrid(players: SportsLineupPlayer[]) {
  return [...players].sort((a, b) => {
    const ag = (a.grid || '99:99').split(':').map(Number);
    const bg = (b.grid || '99:99').split(':').map(Number);
    if (ag[0] !== bg[0]) return ag[0] - bg[0];
    return (ag[1] || 0) - (bg[1] || 0);
  });
}

const LineupBlock = memo(function LineupBlock({
  lineup,
}: {
  lineup?: SportsTeamLineup;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  if (!lineup) {
    return (
      <Muted style={styles.pad}>{t('sportsFixture.noLineup')}</Muted>
    );
  }
  const starters = sortByGrid(lineup.startXI);
  return (
    <Card style={styles.sectionCard}>
      <View style={styles.lineupHead}>
        <Avatar uri={lineup.teamLogo} name={lineup.teamName} size={28} />
        <View style={styles.lineupHeadText}>
          <Subtitle>{lineup.teamName}</Subtitle>
          {lineup.formation ? (
            <Muted>
              {t('sportsFixture.formation')}: {lineup.formation}
            </Muted>
          ) : null}
        </View>
      </View>
      <View
        style={[
          styles.pitch,
          { backgroundColor: theme.colors.surfaceElevated },
        ]}
      >
        {starters.map((p) => (
          <View key={`${p.id}-${p.number}`} style={styles.pitchPlayer}>
            {p.photo ? (
              <Image source={{ uri: p.photo }} style={styles.playerPhoto} />
            ) : (
              <View
                style={[
                  styles.playerPhotoFallback,
                  { backgroundColor: theme.colors.border },
                ]}
              >
                <Text style={{ color: theme.colors.text }}>
                  {p.number ?? '?'}
                </Text>
              </View>
            )}
            <Text
              style={[styles.playerName, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {p.name}
            </Text>
            {p.number != null ? (
              <Text style={[styles.playerNum, { color: theme.colors.textMuted }]}>
                {p.number}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {lineup.substitutes.length > 0 ? (
        <View style={styles.subsBlock}>
          <Subtitle style={styles.subsTitle}>
            {t('sportsFixture.substitutes')}
          </Subtitle>
          {lineup.substitutes.map((p) => (
            <Text
              key={`sub-${p.id}-${p.number}`}
              style={[styles.subRow, { color: theme.colors.text }]}
            >
              {p.number != null ? `${p.number} ` : ''}
              {p.name}
            </Text>
          ))}
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
        { key: 'lineups' as const, label: t('sportsFixture.tabLineups') },
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
            <EventsTab events={detail.events.slice(0, 8)} />
            {detail.statistics.length > 0 ? (
              <StatsTab detail={detail} />
            ) : null}
          </>
        ) : null}
        {tab === 'events' ? <EventsTab events={detail.events} /> : null}
        {tab === 'lineups' ? (
          <>
            <LineupBlock lineup={detail.lineups.home} />
            <LineupBlock lineup={detail.lineups.away} />
          </>
        ) : null}
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
  lineupHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineupHeadText: { flex: 1, gap: 2 },
  pitch: {
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    minHeight: 180,
  },
  pitchPlayer: { width: 72, alignItems: 'center', gap: 4 },
  playerPhoto: { width: 44, height: 44, borderRadius: 22 },
  playerPhotoFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: { fontSize: 10, textAlign: 'center' },
  playerNum: { fontSize: 10 },
  subsBlock: { marginTop: 8, gap: 4 },
  subsTitle: { marginBottom: 4 },
  subRow: { fontSize: 13 },
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

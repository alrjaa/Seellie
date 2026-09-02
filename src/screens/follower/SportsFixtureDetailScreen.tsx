import React, { memo, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { HeaderBackButton } from '@/components/layout/HeaderBackButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, Muted, Subtitle } from '@/components/ui';
import { useSportsFixtureDetail } from '@/hooks/useSportsFixtureDetail';
import { formatArabicDate, formatArabicTime } from '@/utils';
import { cairoText } from '@/theme/fonts';
import { tabBarTotalHeight } from '@/theme/navigation';
import type {
  SportsFixtureDetail,
  SportsLineupPlayer,
  SportsMatchEvent,
  SportsTeamLineup,
} from '@/services/sports-data';

type TabKey = 'overview' | 'events' | 'stats';

function useViewportPitchHeight(chromeHeight: number) {
  const insets = useSafeAreaInsets();
  const { height: screenH, width: screenW } = useWindowDimensions();
  return useMemo(() => {
    const tabH = tabBarTotalHeight(insets.bottom);
    const chrome = chromeHeight > 0 ? chromeHeight : 280;
    const available = screenH - insets.top - tabH - chrome - 8;
    return Math.round(Math.max(available, screenW * 0.92, 360));
  }, [screenH, screenW, insets.top, insets.bottom, chromeHeight]);
}


function isFinished(status: string) {
  const s = status.toUpperCase();
  return s === 'FT' || s === 'AET' || s === 'PEN' || s === 'AWD' || s === 'WO';
}

function isLive(status: string) {
  const s = status.toUpperCase();
  return ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s);
}

function normalizeTeamName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGoalEvent(e: SportsMatchEvent) {
  const detail = (e.detail || '').toLowerCase();
  if (detail.includes('missed penalty')) return false;
  return e.type === 'Goal' || detail.includes('goal');
}

function goalEventsForTeam(
  detail: SportsFixtureDetail,
  side: 'home' | 'away'
) {
  const teamName = normalizeTeamName(
    side === 'home' ? detail.homeName : detail.awayName
  );
  const otherName = normalizeTeamName(
    side === 'home' ? detail.awayName : detail.homeName
  );
  return detail.events.filter((e) => {
    if (!isGoalEvent(e)) return false;
    const evtTeam = normalizeTeamName(e.teamName || '');
    if (evtTeam && teamName) {
      const matchesThis =
        evtTeam === teamName ||
        evtTeam.includes(teamName) ||
        teamName.includes(evtTeam);
      const matchesOther =
        evtTeam === otherName ||
        evtTeam.includes(otherName) ||
        otherName.includes(evtTeam);
      if (matchesThis) return true;
      if (matchesOther) return false;
    }
    return e.teamSide === side;
  });
}

function resolvedScores(detail: SportsFixtureDetail) {
  const homeGoals = goalEventsForTeam(detail, 'home').length;
  const awayGoals = goalEventsForTeam(detail, 'away').length;
  let home = detail.homeScore;
  let away = detail.awayScore;

  if (homeGoals + awayGoals > 0) {
    const apiTotal =
      (home != null ? home : 0) + (away != null ? away : 0);
    const goalsTotal = homeGoals + awayGoals;
    if (
      apiTotal === goalsTotal &&
      home != null &&
      away != null &&
      (home !== homeGoals || away !== awayGoals)
    ) {
      home = homeGoals;
      away = awayGoals;
    }
  }

  return { home, away };
}

function scoreText(d: SportsFixtureDetail) {
  const { home, away } = resolvedScores(d);
  if (home == null || away == null) return 'vs';
  return `${home} - ${away}`;
}

function eventMinute(e: SportsMatchEvent) {
  if (e.extraMinute && e.extraMinute > 0) {
    return `${e.minute}+${e.extraMinute}'`;
  }
  return `${e.minute}'`;
}

const MatchHeader = memo(function MatchHeader({
  detail,
  compact = false,
}: {
  detail: SportsFixtureDetail;
  compact?: boolean;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const scores = resolvedScores(detail);
  const homeGoals = goalEventsForTeam(detail, 'home');
  const awayGoals = goalEventsForTeam(detail, 'away');

  const statusText = isLive(detail.status)
    ? `${t('sportsFixture.live')}${detail.elapsed != null ? ` · ${detail.elapsed}'` : ''}`
    : isFinished(detail.status)
      ? t('sportsFixture.finished')
      : detail.status || t('sportsFixture.scheduled');

  const metaText = [
    detail.date
      ? `${formatArabicDate(detail.date)} · ${formatArabicTime(detail.date)}`
      : '',
    detail.venue,
    detail.city,
  ]
    .filter(Boolean)
    .join(' · ');

  if (compact) {
    return (
      <Card style={styles.headerCardCompact}>
        <View style={styles.compactTopRow}>
          <Text
            style={[styles.leagueLineCompact, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            {detail.leagueName || t('sportsFixture.league')}
            {detail.round ? ` · ${detail.round}` : ''}
          </Text>
          <Text style={[styles.statusLineCompact, { color: theme.colors.accent }]}>
            {statusText}
          </Text>
        </View>
        <View style={styles.scoreBoardCompact}>
          <View style={styles.teamColCompact}>
            <Avatar uri={detail.homeLogo} name={detail.homeName} size={32} />
            <Text
              style={[styles.teamNameCompact, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {detail.homeName}
            </Text>
            <Text style={[styles.teamScoreCompact, { color: theme.colors.text }]}>
              {scores.home != null ? scores.home : '—'}
            </Text>
          </View>
          <View style={styles.teamColCompact}>
            <Avatar uri={detail.awayLogo} name={detail.awayName} size={32} />
            <Text
              style={[styles.teamNameCompact, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {detail.awayName}
            </Text>
            <Text style={[styles.teamScoreCompact, { color: theme.colors.text }]}>
              {scores.away != null ? scores.away : '—'}
            </Text>
          </View>
        </View>
        {metaText ? (
          <Muted style={styles.metaLineCompact} numberOfLines={1}>
            {metaText}
          </Muted>
        ) : null}
      </Card>
    );
  }

  return (
    <Card style={styles.headerCard}>
      <Text style={[styles.leagueLine, { color: theme.colors.textMuted }]}>
        {detail.leagueName || t('sportsFixture.league')}
        {detail.round ? ` · ${detail.round}` : ''}
      </Text>
      <Text style={[styles.statusLine, { color: theme.colors.accent }]}>
        {statusText}
      </Text>
      <View style={styles.scoreBoard}>
        <View style={styles.teamCol}>
          <Avatar uri={detail.homeLogo} name={detail.homeName} size={48} />
          <Text
            style={[styles.teamName, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {detail.homeName}
          </Text>
          <Text style={[styles.teamScore, { color: theme.colors.text }]}>
            {scores.home != null ? scores.home : '—'}
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
        <View style={styles.scoreMid}>
          <Muted style={styles.vsLabel}>
            {scores.home != null && scores.away != null ? 'vs' : ''}
          </Muted>
        </View>
        <View style={styles.teamCol}>
          <Avatar uri={detail.awayLogo} name={detail.awayName} size={48} />
          <Text
            style={[styles.teamName, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {detail.awayName}
          </Text>
          <Text style={[styles.teamScore, { color: theme.colors.text }]}>
            {scores.away != null ? scores.away : '—'}
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
        {metaText}
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

type PitchPos = { top: number; left: number };

function parseGrid(grid?: string) {
  if (!grid) return null;
  const match = String(grid).trim().match(/^(\d+)\s*[:,-]\s*(\d+)$/);
  if (!match) return null;
  const row = Number(match[1]);
  const col = Number(match[2]);
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 1 || col < 1) {
    return null;
  }
  return { row, col };
}

const POSITION_DEPTH: Record<string, number> = {
  G: 0,
  GK: 0,
  D: 1,
  DF: 1,
  DEF: 1,
  CB: 1,
  LB: 1,
  RB: 1,
  LWB: 1,
  RWB: 1,
  SW: 1,
  M: 2,
  MF: 2,
  MID: 2,
  CM: 2,
  DM: 2,
  AM: 2,
  CDM: 2,
  CAM: 2,
  RM: 2,
  LM: 2,
  F: 3,
  FW: 3,
  ST: 3,
  CF: 3,
  ATT: 3,
  SS: 3,
  LW: 3,
  RW: 3,
};

function isGoalkeeper(player: SportsLineupPlayer) {
  const pos = (player.position || '').trim().toUpperCase();
  return pos === 'G' || pos === 'GK';
}

function positionRank(player: SportsLineupPlayer) {
  if (isGoalkeeper(player)) return 0;
  const pos = (player.position || '').trim().toUpperCase();
  if (pos && POSITION_DEPTH[pos] != null) return POSITION_DEPTH[pos];
  return 2;
}

function parseFormationLines(formation?: string) {
  if (!formation?.trim()) return [4, 4, 2];
  const lines = formation
    .split('-')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return lines.length ? lines : [4, 4, 2];
}

type GridBounds = {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
};

const PITCH_AWAY_START = 6;
const PITCH_HOME_END = 94;
const PITCH_HALF_SPAN = 38;
const PITCH_LEFT_MIN = 10;
const PITCH_LEFT_SPAN = 80;

function mapNormToPitch(
  rowNorm: number,
  colNorm: number,
  side: 'home' | 'away'
): PitchPos {
  const top =
    side === 'away'
      ? PITCH_AWAY_START + rowNorm * PITCH_HALF_SPAN
      : PITCH_HOME_END - rowNorm * PITCH_HALF_SPAN;
  const left = PITCH_LEFT_MIN + colNorm * PITCH_LEFT_SPAN;
  return { top, left };
}

function gridBounds(entries: { row: number; col: number }[]): GridBounds {
  const rows = entries.map((e) => e.row);
  const cols = entries.map((e) => e.col);
  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols),
  };
}

function shouldInvertGridRows(
  players: SportsLineupPlayer[],
  bounds: GridBounds
) {
  if (bounds.maxRow <= bounds.minRow) return false;
  const gk = players.find(isGoalkeeper);
  const gkRow = gk ? parseGrid(gk.grid)?.row : null;
  return gkRow != null && gkRow === bounds.maxRow;
}

function buildFromGrid(
  players: SportsLineupPlayer[],
  side: 'home' | 'away'
): Map<number, PitchPos> {
  const positions = new Map<number, PitchPos>();
  const entries = players
    .map((player) => ({ player, grid: parseGrid(player.grid) }))
    .filter(
      (
        entry
      ): entry is {
        player: SportsLineupPlayer;
        grid: { row: number; col: number };
      } => entry.grid != null
    );

  if (entries.length < Math.max(6, Math.ceil(players.length * 0.55))) {
    return positions;
  }

  const bounds = gridBounds(entries.map((entry) => entry.grid));
  const uniqueRows = new Set(entries.map((entry) => entry.grid.row)).size;
  const uniqueCols = new Set(entries.map((entry) => entry.grid.col)).size;
  if (
    bounds.maxRow === bounds.minRow ||
    bounds.maxCol === bounds.minCol ||
    uniqueRows < 3 ||
    uniqueCols < 3
  ) {
    return positions;
  }

  const invertRows = shouldInvertGridRows(players, bounds);

  entries.forEach(({ player, grid }) => {
    const row = invertRows
      ? bounds.minRow + bounds.maxRow - grid.row
      : grid.row;
    const rowNorm =
      bounds.maxRow === bounds.minRow
        ? 0
        : (row - bounds.minRow) / (bounds.maxRow - bounds.minRow);
    const colNorm =
      bounds.maxCol === bounds.minCol
        ? 0.5
        : (grid.col - bounds.minCol) / (bounds.maxCol - bounds.minCol);
    positions.set(player.id, mapNormToPitch(rowNorm, colNorm, side));
  });

  return positions;
}

function assignPlayersToLines(
  players: SportsLineupPlayer[],
  formation?: string
): SportsLineupPlayer[][] {
  const goalkeepers = players.filter(isGoalkeeper);
  const outfield = players
    .filter((player) => !isGoalkeeper(player))
    .sort((a, b) => {
      const rankDiff = positionRank(a) - positionRank(b);
      if (rankDiff !== 0) return rankDiff;
      return (a.number ?? 99) - (b.number ?? 99);
    });

  const lineSizes = parseFormationLines(formation);
  const lines: SportsLineupPlayer[][] = goalkeepers.length ? [goalkeepers] : [];
  let cursor = 0;

  lineSizes.forEach((size) => {
    const line: SportsLineupPlayer[] = [];
    for (let i = 0; i < size && cursor < outfield.length; i += 1, cursor += 1) {
      line.push(outfield[cursor]);
    }
    if (line.length) lines.push(line);
  });

  if (cursor < outfield.length) {
    const tail = outfield.slice(cursor);
    if (lines.length) {
      lines[lines.length - 1].push(...tail);
    } else {
      lines.push(tail);
    }
  }

  if (!lines.length && players.length) {
    lines.push([...players]);
  }

  return lines;
}

function buildFromFormation(
  players: SportsLineupPlayer[],
  side: 'home' | 'away',
  formation?: string
): Map<number, PitchPos> {
  const positions = new Map<number, PitchPos>();
  const lines = assignPlayersToLines(players, formation);
  const lineCount = lines.length;

  lines.forEach((linePlayers, lineIdx) => {
    const rowNorm = lineCount <= 1 ? 0 : lineIdx / (lineCount - 1);
    linePlayers.forEach((player, playerIdx) => {
      const colNorm =
        linePlayers.length === 1
          ? 0.5
          : playerIdx / Math.max(linePlayers.length - 1, 1);
      positions.set(player.id, mapNormToPitch(rowNorm, colNorm, side));
    });
  });

  return positions;
}

function buildPitchLayout(
  players: SportsLineupPlayer[],
  side: 'home' | 'away',
  formation?: string
): Map<number, PitchPos> {
  if (!players.length) return new Map();

  const fromGrid = buildFromGrid(players, side);
  if (fromGrid.size >= Math.max(6, Math.ceil(players.length * 0.55))) {
    return fromGrid;
  }

  const fromFormation = buildFromFormation(players, side, formation);
  players.forEach((player) => {
    if (!fromFormation.has(player.id) && fromGrid.has(player.id)) {
      fromFormation.set(player.id, fromGrid.get(player.id)!);
    }
  });
  return fromFormation;
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
            <Ionicons name="person" size={14} color="rgba(255,255,255,0.7)" />
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
  pitchHeight: pitchHeightProp,
  overviewMode = false,
}: {
  detail: SportsFixtureDetail;
  home?: SportsTeamLineup;
  away?: SportsTeamLineup;
  pitchHeight?: number;
  overviewMode?: boolean;
}) {
  const { t } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const scores = resolvedScores(detail);
  const fallbackHeight = Math.round(
    Math.min(Math.max(screenW * 1.58, 540), screenH * 0.82)
  );
  const pitchHeight = pitchHeightProp ?? fallbackHeight;

  if (!home?.startXI?.length && !away?.startXI?.length) {
    return (
      <Card style={styles.sectionCard}>
        <Muted style={styles.pad}>{t('sportsFixture.noLineup')}</Muted>
      </Card>
    );
  }

  const homeXi = home?.startXI ?? [];
  const awayXi = away?.startXI ?? [];
  const homePos = buildPitchLayout(homeXi, 'home', home?.formation);
  const awayPos = buildPitchLayout(awayXi, 'away', away?.formation);
  const statusLabel = isLive(detail.status)
    ? t('sportsFixture.live')
    : isFinished(detail.status)
      ? t('sportsFixture.finished')
      : detail.status || t('sportsFixture.scheduled');

  return (
    <Card style={styles.pitchCard}>
      <View style={[styles.pitchWrap, { height: pitchHeight }]}>
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
            <View style={styles.pitchScoreSide}>
              <Avatar uri={detail.homeLogo} name={detail.homeName} size={18} />
              <Text style={styles.pitchScoreTeamText}>
                {scores.home != null ? scores.home : '—'}
              </Text>
            </View>
            <Text style={styles.pitchStatusText}>{statusLabel}</Text>
            <View style={styles.pitchScoreSide}>
              <Text style={styles.pitchScoreTeamText}>
                {scores.away != null ? scores.away : '—'}
              </Text>
              <Avatar uri={detail.awayLogo} name={detail.awayName} size={18} />
            </View>
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

          {overviewMode && (home?.formation || away?.formation) ? (
            <View style={styles.pitchFormationOverlay}>
              <Muted style={styles.pitchFormationText}>
                {away?.formation ? `${away.formation}` : ''}
                {away?.formation && home?.formation ? ' · ' : ''}
                {home?.formation ? `${home.formation}` : ''}
              </Muted>
            </View>
          ) : null}
        </View>
      </View>

      {!overviewMode && (home?.formation || away?.formation) ? (
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

      {!overviewMode && (home?.substitutes.length || away?.substitutes.length) ? (
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
  const [chromeHeight, setChromeHeight] = useState(0);
  const pitchHeight = useViewportPitchHeight(chromeHeight);
  const onChromeLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    setChromeHeight((prev) => (prev === next ? prev : next));
  }, []);
  const isOverview = tab === 'overview';

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
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!detail || error) {
    return (
      <Screen scroll={false}>
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
    <Screen scroll fabClearance={false}>
      <View onLayout={onChromeLayout} style={styles.chromeBlock}>
        <View style={styles.topBar}>
          <HeaderBackButton />
        </View>

        <MatchHeader detail={detail} compact={isOverview} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          style={styles.tabsScroll}
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
      </View>

      {isOverview ? (
        <>
          <FootballPitchLineups
            overviewMode
            pitchHeight={pitchHeight}
            detail={detail}
            home={detail.lineups.home}
            away={detail.lineups.away}
          />
          {detail.events.length > 0 ? (
            <EventsTab events={detail.events.slice(0, 6)} />
          ) : null}
        </>
      ) : null}
      {tab === 'events' ? <EventsTab events={detail.events} /> : null}
      {tab === 'stats' ? <StatsTab detail={detail} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chromeBlock: { gap: 8 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  tabsScroll: {
    flexGrow: 0,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: { padding: 12, gap: 6 },
  headerCardCompact: { padding: 8, gap: 4 },
  compactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  leagueLineCompact: { flex: 1, fontSize: 11 },
  statusLineCompact: { fontSize: 11, ...cairoText('semiBold') },
  scoreBoardCompact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    direction: 'ltr',
  },
  teamColCompact: { flex: 1, alignItems: 'center', gap: 2 },
  teamNameCompact: {
    fontSize: 11,
    textAlign: 'center',
    ...cairoText('semiBold'),
  },
  teamScoreCompact: {
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
    ...cairoText('bold'),
  },
  metaLineCompact: { textAlign: 'center', fontSize: 10 },
  leagueLine: { fontSize: 13, textAlign: 'center' },
  statusLine: { fontSize: 12, textAlign: 'center', ...cairoText('semiBold') },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    direction: 'ltr',
  },
  teamCol: { flex: 1, alignItems: 'center', gap: 4 },
  teamName: {
    fontSize: 13,
    textAlign: 'center',
    ...cairoText('semiBold'),
  },
  teamScore: {
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
    ...cairoText('bold'),
  },
  scoreMid: {
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 36,
  },
  vsLabel: { fontSize: 11, textAlign: 'center' },
  scorer: { fontSize: 10, textAlign: 'center' },
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
  pitchWrap: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  pitchField: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1f5f35',
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
    top: 8,
    left: '6%',
    right: '6%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
    direction: 'ltr',
  },
  pitchScoreSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pitchScoreTeamText: {
    color: '#fff',
    fontSize: 16,
    minWidth: 18,
    textAlign: 'center',
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
  pitchFormationOverlay: {
    position: 'absolute',
    bottom: 6,
    left: '8%',
    right: '8%',
    alignItems: 'center',
    zIndex: 3,
  },
  pitchFormationText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    textAlign: 'center',
  },
  pitchPlayerAbs: {
    position: 'absolute',
    width: 40,
    marginLeft: -20,
    marginTop: -18,
    alignItems: 'center',
    zIndex: 4,
  },
  pitchPhotoWrap: {
    width: 28,
    height: 28,
    position: 'relative',
  },
  pitchPhoto: {
    width: 28,
    height: 28,
    borderRadius: 6,
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
    bottom: -3,
    left: -5,
    minWidth: 20,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  ratingText: {
    color: '#fff',
    fontSize: 8,
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
    marginTop: 1,
    fontSize: 7,
    textAlign: 'center',
    maxWidth: 40,
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

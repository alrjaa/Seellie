import React, { memo, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation, useLanguage } from '@/providers/LanguageProvider';
import { Avatar, Card, Muted, Subtitle } from '@/components/ui';
import { useNationalLeague } from '@/hooks/useNationalLeague';
import { formatArabicDate, formatArabicTime } from '@/utils';
import {
  SAUDI_PRO_LEAGUE_ID,
  TRACKED_LEAGUES,
  type SportsFixture,
  type SportsStandingRow,
  type SportsTopScorerRow,
} from '@/services/sports-data';
import { cairoText } from '@/theme/fonts';

function useTitleDir() {
  const { isRTL } = useLanguage();
  return useMemo(
    () => ({
      textAlign: 'left' as const,
      writingDirection: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
      width: '100%' as const,
      alignSelf: 'stretch' as const,
    }),
    [isRTL]
  );
}

function scoreLabel(f: SportsFixture): string {
  if (f.homeScore == null || f.awayScore == null) return 'vs';
  return `${f.homeScore} - ${f.awayScore}`;
}

function isLiveStatus(status: string) {
  const s = status.toUpperCase();
  return (
    s === '1H' ||
    s === '2H' ||
    s === 'HT' ||
    s === 'ET' ||
    s === 'BT' ||
    s === 'P' ||
    s === 'LIVE'
  );
}

const NationalStandings = memo(function NationalStandings({
  rows,
}: {
  rows: SportsStandingRow[];
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  if (!rows.length) return null;
  return (
    <Card style={styles.card}>
      <View style={[styles.head, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.thRank, { color: theme.colors.textMuted }]}>#</Text>
        <Text style={[styles.thTeam, { color: theme.colors.textMuted }]}>
          {t('home.team')}
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
        <Text style={[styles.thPts, { color: theme.colors.textMuted }]}>
          {t('home.pointsAbbr')}
        </Text>
      </View>
      {rows.slice(0, 10).map((row) => (
        <View
          key={`${row.teamId}-${row.rank}`}
          style={[styles.row, { borderBottomColor: theme.colors.border }]}
        >
          <Text style={[styles.tdRank, { color: theme.colors.textMuted }]}>
            {row.rank}
          </Text>
          <View style={styles.teamCell}>
            <Avatar uri={row.teamLogo} name={row.teamName} size={24} />
            <Text
              style={[styles.tdTeam, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {row.teamName}
            </Text>
          </View>
          <Text style={[styles.td, { color: theme.colors.text }]}>
            {row.played}
          </Text>
          <Text style={[styles.td, { color: theme.colors.text }]}>{row.won}</Text>
          <Text style={[styles.td, { color: theme.colors.text }]}>
            {row.drawn}
          </Text>
          <Text style={[styles.td, { color: theme.colors.text }]}>{row.lost}</Text>
          <Text style={[styles.tdPts, { color: theme.colors.accent }]}>
            {row.points}
          </Text>
        </View>
      ))}
    </Card>
  );
});

const NationalTopScorers = memo(function NationalTopScorers({
  rows,
}: {
  rows: SportsTopScorerRow[];
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const titleDir = useTitleDir();
  return (
    <Card style={styles.card}>
      <Subtitle style={[styles.cardTitle, titleDir]}>
        {t('home.nationalTopScorers')}
      </Subtitle>
      {!rows.length ? (
        <Muted style={titleDir}>{t('home.nationalTopScorersUnavailable')}</Muted>
      ) : (
        <>
          <View style={[styles.head, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.thRank, { color: theme.colors.textMuted }]}>
              #
            </Text>
            <Text style={[styles.thTeam, { color: theme.colors.textMuted }]}>
              {t('home.player')}
            </Text>
            <Text style={[styles.thGoals, { color: theme.colors.textMuted }]}>
              {t('home.goalsAbbr')}
            </Text>
            <Text style={[styles.thGoals, { color: theme.colors.textMuted }]}>
              {t('home.assistsAbbr')}
            </Text>
          </View>
          {rows.slice(0, 10).map((row) => (
            <View
              key={`${row.playerId}-${row.rank}`}
              style={[styles.row, { borderBottomColor: theme.colors.border }]}
            >
              <Text style={[styles.tdRank, { color: theme.colors.textMuted }]}>
                {row.rank}
              </Text>
              <View style={styles.teamCell}>
                <Avatar
                  uri={row.playerPhoto || row.teamLogo}
                  name={row.playerName}
                  size={24}
                />
                <View style={styles.scorerTextCol}>
                  <Text
                    style={[styles.tdTeam, { color: theme.colors.text }]}
                    numberOfLines={1}
                  >
                    {row.playerName}
                  </Text>
                  {row.teamName ? (
                    <Text
                      style={[
                        styles.scorerTeam,
                        { color: theme.colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {row.teamName}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.tdGoals, { color: theme.colors.accent }]}>
                {row.goals}
              </Text>
              <Text style={[styles.tdGoals, { color: theme.colors.text }]}>
                {row.assists == null ? '—' : row.assists}
              </Text>
            </View>
          ))}
        </>
      )}
    </Card>
  );
});

const NationalFixtures = memo(function NationalFixtures({
  title,
  fixtures,
}: {
  title: string;
  fixtures: SportsFixture[];
}) {
  const theme = useAppTheme();
  const titleDir = useTitleDir();
  const router = useRouter();
  if (!fixtures.length) return null;
  return (
    <Card style={styles.card}>
      <Subtitle style={[styles.cardTitle, titleDir]}>{title}</Subtitle>
      {fixtures.slice(0, 6).map((f) => (
        <Pressable
          key={f.id || `${f.homeName}-${f.date}`}
          onPress={() => {
            if (!f.id) return;
            router.push(`/(follower)/sports/fixtures/${f.id}` as any);
          }}
          style={({ pressed }) => [
            styles.fxRow,
            { borderBottomColor: theme.colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={styles.fxDateCol}>
            <Text
              style={[styles.fxDate, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {f.date ? formatArabicDate(f.date) : '—'}
            </Text>
            <Muted>
              {f.date ? formatArabicTime(f.date) : ''}
              {isLiveStatus(f.status) && f.elapsed != null
                ? ` · ${f.elapsed}'`
                : f.status
                  ? ` · ${f.status}`
                  : ''}
            </Muted>
          </View>
          <View style={styles.fxMatchCol}>
            <View style={styles.fxTeamLine}>
              <Avatar uri={f.homeLogo} name={f.homeName} size={20} />
              <Text
                style={[styles.fxTeam, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {f.homeName}
              </Text>
            </View>
            <View style={styles.fxTeamLine}>
              <Avatar uri={f.awayLogo} name={f.awayName} size={20} />
              <Text
                style={[styles.fxTeam, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {f.awayName}
              </Text>
            </View>
          </View>
          <Text style={[styles.fxScore, { color: theme.colors.text }]}>
            {scoreLabel(f)}
          </Text>
        </Pressable>
      ))}
    </Card>
  );
});

type SeasonTab = 'current' | 'previous';

/**
 * قسم الدوريات العالمية — اختيار دوري + موسم حالي/سابق داخل نافذة الموسمين.
 */
export const NationalLeagueHomeSection = memo(
  function NationalLeagueHomeSection() {
    const theme = useAppTheme();
    const { t, language } = useTranslation();
    const titleDir = useTitleDir();
    const [leagueId, setLeagueId] = useState(SAUDI_PRO_LEAGUE_ID);
    const [seasonTab, setSeasonTab] = useState<SeasonTab>('current');
    const { loading, bundle, unavailable } = useNationalLeague({ leagueId });

    const selectedMeta = TRACKED_LEAGUES.find((l) => l.leagueId === leagueId);
    const leagueTitle =
      language === 'en'
        ? selectedMeta?.nameEn || bundle?.leagueName
        : selectedMeta?.nameAr || bundle?.leagueName;

    const hasPrevious =
      !!bundle?.window?.previous &&
      ((bundle.previousStandings?.length ?? 0) > 0 ||
        (bundle.previousLastFixtures?.length ?? 0) > 0 ||
        (bundle.previousTopScorers?.length ?? 0) > 0);

    const viewingPrevious = seasonTab === 'previous' && hasPrevious;

    const standings = viewingPrevious
      ? bundle?.previousStandings || []
      : bundle?.standings || [];
    const lastFixtures = viewingPrevious
      ? bundle?.previousLastFixtures || []
      : bundle?.lastFixtures || [];
    const nextFixtures = viewingPrevious ? [] : bundle?.nextFixtures || [];
    const liveFixtures = viewingPrevious ? [] : bundle?.liveFixtures || [];
    const topScorers = viewingPrevious
      ? bundle?.previousTopScorers || []
      : bundle?.topScorers || [];
    const nextMatch = liveFixtures[0] || nextFixtures[0];
    const displaySeason = viewingPrevious
      ? bundle?.window?.previous
      : bundle?.window?.current || bundle?.season;

    return (
      <View style={styles.section}>
        <Subtitle style={[styles.sectionTitle, titleDir]}>
          {t('home.nationalLeague')}
        </Subtitle>
        <Muted style={[styles.sectionTitle, titleDir]}>
          {t('home.nationalLeaguePickHint')}
        </Muted>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.leagueRow}
        >
          {TRACKED_LEAGUES.map((league) => {
            const active = league.leagueId === leagueId;
            const label = language === 'en' ? league.nameEn : league.nameAr;
            return (
              <Pressable
                key={league.leagueId}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setLeagueId(league.leagueId);
                  setSeasonTab('current');
                }}
                style={[
                  styles.leagueChip,
                  {
                    backgroundColor: active
                      ? theme.colors.accent
                      : theme.colors.inputBg,
                    borderColor: active
                      ? theme.colors.accent
                      : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.leagueChipText,
                    cairoText('semiBold'),
                    {
                      color: active
                        ? theme.colors.textInverse
                        : theme.colors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading && !bundle ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : unavailable || !bundle ? (
          <Muted style={titleDir}>{t('home.nationalLeagueUnavailable')}</Muted>
        ) : (
          <>
            <Subtitle style={[styles.sectionTitle, titleDir]}>
              {leagueTitle || t('home.nationalLeague')}
            </Subtitle>

            <View style={styles.seasonRow}>
              <Pressable
                onPress={() => setSeasonTab('current')}
                style={[
                  styles.seasonChip,
                  {
                    borderColor:
                      seasonTab === 'current'
                        ? theme.colors.accent
                        : theme.colors.border,
                    backgroundColor:
                      seasonTab === 'current'
                        ? theme.colors.inputBg
                        : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.seasonChipText,
                    { color: theme.colors.text },
                    cairoText('medium'),
                  ]}
                >
                  {t('home.nationalSeasonCurrent', {
                    season: bundle.window?.current || bundle.season,
                  })}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => hasPrevious && setSeasonTab('previous')}
                disabled={!hasPrevious}
                style={[
                  styles.seasonChip,
                  {
                    opacity: hasPrevious ? 1 : 0.45,
                    borderColor:
                      seasonTab === 'previous'
                        ? theme.colors.accent
                        : theme.colors.border,
                    backgroundColor:
                      seasonTab === 'previous'
                        ? theme.colors.inputBg
                        : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.seasonChipText,
                    { color: theme.colors.text },
                    cairoText('medium'),
                  ]}
                >
                  {hasPrevious
                    ? t('home.nationalSeasonPrevious', {
                        season: bundle.window?.previous,
                      })
                    : t('home.nationalSeasonPreviousUnavailable')}
                </Text>
              </Pressable>
            </View>

            <Muted style={titleDir}>
              {t('home.nationalSeasonLabel', { season: displaySeason })}
            </Muted>

            {nextMatch ? (
              <Card style={styles.nextCard}>
                <Muted style={titleDir}>{t('home.nationalNextMatch')}</Muted>
                <View style={styles.nextRow}>
                  <View style={styles.nextTeam}>
                    <Avatar
                      uri={nextMatch.homeLogo}
                      name={nextMatch.homeName}
                      size={44}
                    />
                    <Text
                      style={[styles.nextName, { color: theme.colors.text }]}
                      numberOfLines={2}
                    >
                      {nextMatch.homeName}
                    </Text>
                  </View>
                  <Text style={[styles.vs, { color: theme.colors.textMuted }]}>
                    {scoreLabel(nextMatch)}
                  </Text>
                  <View style={styles.nextTeam}>
                    <Avatar
                      uri={nextMatch.awayLogo}
                      name={nextMatch.awayName}
                      size={44}
                    />
                    <Text
                      style={[styles.nextName, { color: theme.colors.text }]}
                      numberOfLines={2}
                    >
                      {nextMatch.awayName}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            <NationalFixtures
              title={t('home.nationalLive')}
              fixtures={liveFixtures}
            />
            <NationalFixtures
              title={t('home.nationalUpcoming')}
              fixtures={nextFixtures}
            />
            <NationalFixtures
              title={t('home.nationalResults')}
              fixtures={lastFixtures}
            />
            <NationalTopScorers rows={topScorers} />
            <NationalStandings rows={standings} />
          </>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  section: { gap: 10, marginBottom: 8 },
  sectionTitle: { marginBottom: 0 },
  loadingBox: { paddingVertical: 18, alignItems: 'center' },
  leagueRow: { gap: 8, paddingVertical: 2 },
  leagueChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  leagueChipText: { fontSize: 12 },
  seasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seasonChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  seasonChipText: { fontSize: 12 },
  card: { gap: 0, paddingVertical: 10 },
  cardTitle: { marginBottom: 8, fontSize: 14 },
  nextCard: { gap: 10 },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nextTeam: { flex: 1, alignItems: 'center', gap: 6 },
  nextName: {
    fontSize: 13,
    textAlign: 'center',
    ...cairoText('semiBold'),
  },
  vs: { fontSize: 14, fontWeight: '800' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  thRank: { width: 22, fontSize: 11, textAlign: 'center' },
  thTeam: { flex: 1, fontSize: 11 },
  th: { width: 22, fontSize: 11, textAlign: 'center' },
  thPts: { width: 26, fontSize: 11, textAlign: 'center' },
  thGoals: { width: 28, fontSize: 11, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  tdRank: { width: 22, fontSize: 12, textAlign: 'center' },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  scorerTextCol: { flex: 1, gap: 1 },
  tdTeam: { flex: 1, fontSize: 12, ...cairoText('medium') },
  scorerTeam: { fontSize: 10 },
  td: { width: 22, fontSize: 12, textAlign: 'center' },
  tdPts: {
    width: 26,
    fontSize: 12,
    textAlign: 'center',
    ...cairoText('bold'),
  },
  tdGoals: {
    width: 28,
    fontSize: 12,
    textAlign: 'center',
    ...cairoText('bold'),
  },
  fxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  fxDateCol: { width: 78 },
  fxDate: { fontSize: 11, ...cairoText('semiBold') },
  fxMatchCol: { flex: 1, gap: 4 },
  fxTeamLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fxTeam: { flex: 1, fontSize: 12 },
  fxScore: {
    width: 48,
    textAlign: 'center',
    fontSize: 12,
    ...cairoText('bold'),
  },
});

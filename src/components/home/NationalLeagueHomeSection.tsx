import React, { memo, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation, useLanguage } from '@/providers/LanguageProvider';
import { Avatar, Card, Muted, Subtitle } from '@/components/ui';
import { useNationalLeague } from '@/hooks/useNationalLeague';
import { formatArabicDate, formatArabicTime } from '@/utils';
import type { SportsFixture, SportsStandingRow } from '@/services/sports-data';
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
  return s === '1H' || s === '2H' || s === 'HT' || s === 'ET' || s === 'BT' || s === 'P' || s === 'LIVE';
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

const NationalFixtures = memo(function NationalFixtures({
  title,
  fixtures,
}: {
  title: string;
  fixtures: SportsFixture[];
}) {
  const theme = useAppTheme();
  const titleDir = useTitleDir();
  if (!fixtures.length) return null;
  return (
    <Card style={styles.card}>
      <Subtitle style={[styles.cardTitle, titleDir]}>{title}</Subtitle>
      {fixtures.slice(0, 6).map((f) => (
        <View
          key={f.id || `${f.homeName}-${f.date}`}
          style={[styles.fxRow, { borderBottomColor: theme.colors.border }]}
        >
          <View style={styles.fxDateCol}>
            <Text style={[styles.fxDate, { color: theme.colors.text }]} numberOfLines={1}>
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
        </View>
      ))}
    </Card>
  );
});

/**
 * قسم الدوري العام (حي عبر Edge Function) — لا يستبدل جداول المنصة.
 * عند فشل المزود: رسالة خفيفة أو إخفاء صامت إن لم يُضبط السر بعد.
 */
export const NationalLeagueHomeSection = memo(
  function NationalLeagueHomeSection() {
    const theme = useAppTheme();
    const { t } = useTranslation();
    const titleDir = useTitleDir();
    const { loading, bundle, unavailable } = useNationalLeague();

    const nextMatch = bundle?.nextFixtures?.[0] || bundle?.liveFixtures?.[0];

    if (loading && !bundle) {
      return (
        <View style={styles.section}>
          <Subtitle style={[styles.sectionTitle, titleDir]}>
            {t('home.nationalLeague')}
          </Subtitle>
          <Muted style={[styles.sectionTitle, titleDir]}>
            {t('home.nationalLeagueSub')}
          </Muted>
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        </View>
      );
    }

    // غير مضبوط / فشل: لا نكسر الرئيسية — نعرض تلميحاً خفيفاً فقط
    if (unavailable || !bundle) {
      return (
        <View style={styles.section}>
          <Subtitle style={[styles.sectionTitle, titleDir]}>
            {t('home.nationalLeague')}
          </Subtitle>
          <Muted style={[styles.sectionTitle, titleDir]}>
            {t('home.nationalLeagueUnavailable')}
          </Muted>
        </View>
      );
    }

    const hasAny =
      !!nextMatch ||
      bundle.liveFixtures.length > 0 ||
      bundle.nextFixtures.length > 0 ||
      bundle.lastFixtures.length > 0 ||
      bundle.standings.length > 0;

    if (!hasAny) {
      return (
        <View style={styles.section}>
          <Subtitle style={[styles.sectionTitle, titleDir]}>
            {t('home.nationalLeague')}
          </Subtitle>
          <Muted style={[styles.sectionTitle, titleDir]}>
            {t('home.nationalLeagueEmpty')}
          </Muted>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Subtitle style={[styles.sectionTitle, titleDir]}>
          {bundle.leagueName || t('home.nationalLeague')}
        </Subtitle>
        <Muted style={[styles.sectionTitle, titleDir]}>
          {t('home.nationalLeagueSub')}
          {bundle.season ? ` · ${t('home.nationalSeasonLabel', { season: bundle.season })}` : ''}
          {bundle.window?.previous
            ? ` · ${t('home.nationalPreviousSeason', { season: bundle.window.previous })}`
            : ''}
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
            {nextMatch.date ? (
              <Muted style={titleDir}>
                {formatArabicDate(nextMatch.date)} ·{' '}
                {formatArabicTime(nextMatch.date)}
              </Muted>
            ) : null}
          </Card>
        ) : null}

        <NationalFixtures
          title={t('home.nationalLive')}
          fixtures={bundle.liveFixtures}
        />
        <NationalFixtures
          title={t('home.nationalUpcoming')}
          fixtures={bundle.nextFixtures}
        />
        <NationalFixtures
          title={t('home.nationalResults')}
          fixtures={bundle.lastFixtures}
        />
        <NationalStandings rows={bundle.standings} />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  section: { gap: 10, marginBottom: 8 },
  sectionTitle: { marginBottom: 0 },
  loadingBox: { paddingVertical: 18, alignItems: 'center' },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  tdRank: { width: 22, fontSize: 12, textAlign: 'center' },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tdTeam: { flex: 1, fontSize: 12, ...cairoText('medium') },
  td: { width: 22, fontSize: 12, textAlign: 'center' },
  tdPts: {
    width: 26,
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

import React, { memo, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useTournament,
  type Competition,
  type Match,
  type Player,
  type User,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation, useLanguage } from '@/providers/LanguageProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { Screen } from '@/components/layout/Screen';
import { HomeHeader } from '@/components/layout/HomeHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import {
  Avatar,
  Button,
  Card,
  ListRow,
  Muted,
  SearchBar,
  Subtitle,
} from '@/components/ui';
import { useResponsive } from '@/hooks/useResponsive';
import { formatArabicDate, formatArabicTime } from '@/utils';
import {
  computeStandings,
  formatVenueAddress,
  selectHomeCompetitions,
} from '@/utils/competition';
import { userHasRole } from '@/utils/roles';
import { cairoText } from '@/theme/fonts';
import { NationalLeagueHomeSection } from '@/components/home/NationalLeagueHomeSection';

function useHomeTitleDir() {
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

type CombinedPlayer = (Player | User) & {
  totalLikes: number;
  teamName?: string;
  teamLogo?: string;
  isFreelancer?: boolean;
};

const UpcomingMatchCard = memo(function UpcomingMatchCard({
  match,
  competition,
  onPress,
}: {
  match: Match;
  competition: Competition;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const team1 = competition.teams.find((t) => t.id === match.team1Id);
  const team2 = competition.teams.find((t) => t.id === match.team2Id);
  if (!team1 || !team2) return null;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.matchCard}>
      <View style={styles.teamsRow}>
        <View style={styles.teamCol}>
          <Avatar uri={team1.logo} name={team1.name} size={52} />
          <Text style={[styles.teamName, { color: theme.colors.text }]}>
            {team1.name}
          </Text>
        </View>
        <Text style={[styles.vs, { color: theme.colors.textMuted }]}>vs</Text>
        <View style={styles.teamCol}>
          <Avatar uri={team2.logo} name={team2.name} size={52} />
          <Text style={[styles.teamName, { color: theme.colors.text }]}>
            {team2.name}
          </Text>
        </View>
      </View>
      <Muted>{competition.name}</Muted>
      <Muted>{formatArabicDate(match.date)}</Muted>
      <Muted>{formatArabicTime(match.date)}</Muted>
      </Card>
    </Pressable>
  );
});

const PlayerCard = memo(function PlayerCard({
  item,
  onPress,
}: {
  item: CombinedPlayer;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const roleLabel = item.isFreelancer
    ? t('home.freelancerPlayer')
    : t('searchUi.kindPlayer');

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.playerCard} padded={false}>
        <View style={styles.playerCardInner}>
          <Avatar uri={item.avatar} name={item.name} size={64} />
          <Text
            style={[styles.playerRole, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            {roleLabel}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
});

const StandingsTable = memo(function StandingsTable({
  competition,
  pinned,
  onOpen,
  onTogglePin,
}: {
  competition: Competition;
  pinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const titleDir = useHomeTitleDir();
  const standings = useMemo(
    () => computeStandings(competition),
    [competition]
  );

  if (standings.length === 0) return null;

  return (
    <Card style={styles.standingsCard}>
      <View style={styles.compHeader}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          style={styles.compTitlePress}
        >
          <Subtitle style={[styles.compTitle, titleDir]}>{competition.name}</Subtitle>
          <Muted style={[styles.compMeta, titleDir]}>
            {competition.venue?.city || t('home.noCity')}
            {pinned ? ` · ${t('home.pinned')}` : ''}
          </Muted>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            pinned ? t('screens.unpinCompetition') : t('screens.pinCompetition')
          }
          onPress={onTogglePin}
          hitSlop={8}
        >
          <Ionicons
            name={pinned ? 'pin' : 'pin-outline'}
            size={20}
            color={pinned ? theme.colors.accent : theme.colors.textMuted}
          />
        </Pressable>
      </View>

      <View
        style={[styles.tableHead, { borderBottomColor: theme.colors.border }]}
      >
        <Text style={[styles.thRank, { color: theme.colors.textMuted }]}>#</Text>
        <Text style={[styles.thTeam, { color: theme.colors.textMuted }]}>
          {t('home.team')}
        </Text>
        <Text style={[styles.th, { color: theme.colors.textMuted }]}>{t('home.playedAbbr')}</Text>
        <Text style={[styles.th, { color: theme.colors.textMuted }]}>{t('home.wonAbbr')}</Text>
        <Text style={[styles.th, { color: theme.colors.textMuted }]}>{t('home.drawnAbbr')}</Text>
        <Text style={[styles.th, { color: theme.colors.textMuted }]}>{t('home.lostAbbr')}</Text>
        <Text style={[styles.th, { color: theme.colors.textMuted }]}>+/-</Text>
        <Text style={[styles.th, { color: theme.colors.textMuted }]}>{t('home.pointsAbbr')}</Text>
      </View>

      {standings.map((row, index) => (
        <View
          key={row.teamId}
          style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}
        >
          <Text style={[styles.tdRank, { color: theme.colors.textMuted }]}>
            {index + 1}
          </Text>
          <View style={styles.teamCell}>
            <Avatar uri={row.teamLogo} name={row.teamName} size={28} />
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
          <Text style={[styles.td, { color: theme.colors.text }]}>
            {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
          </Text>
          <Text style={[styles.tdPoints, { color: theme.colors.accent }]}>
            {row.points}
          </Text>
        </View>
      ))}

      <Button
        label={t('home.competitionDetails')}
        variant="ghost"
        onPress={onOpen}
      />
    </Card>
  );
});

function isMatchPlayed(match: Match): boolean {
  const now = Date.now();
  return (
    new Date(match.date).getTime() <= now ||
    match.team1Score > 0 ||
    match.team2Score > 0
  );
}

const FixturesTable = memo(function FixturesTable({
  competition,
  pinned,
  onOpenMatch,
  onOpenCompetition,
  onTogglePin,
}: {
  competition: Competition;
  pinned: boolean;
  onOpenMatch: (matchId: string) => void;
  onOpenCompetition: () => void;
  onTogglePin: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const titleDir = useHomeTitleDir();
  const fixtures = useMemo(
    () =>
      [...competition.matches].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [competition.matches]
  );

  if (fixtures.length === 0) return null;

  const teamName = (id: string) =>
    competition.teams.find((t) => t.id === id)?.name || '—';
  const teamLogo = (id: string) =>
    competition.teams.find((t) => t.id === id)?.logo;

  return (
    <Card style={styles.fixturesCard}>
      <View style={styles.compHeader}>
        <Pressable
          onPress={onOpenCompetition}
          accessibilityRole="button"
          style={styles.compTitlePress}
        >
          <Subtitle style={[styles.compTitle, titleDir]}>{competition.name}</Subtitle>
          <Muted style={[styles.compMeta, titleDir]}>
            {competition.venue?.city || t('home.noCity')}
            {pinned ? ` · ${t('home.pinned')}` : ''} · {t('home.matchesCount', { count: fixtures.length })}
          </Muted>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pinned ? t('screens.unpinCompetition') : t('screens.pinCompetition')}
          onPress={onTogglePin}
          hitSlop={8}
        >
          <Ionicons
            name={pinned ? 'pin' : 'pin-outline'}
            size={20}
            color={pinned ? theme.colors.accent : theme.colors.textMuted}
          />
        </Pressable>
      </View>

      <View
        style={[styles.fxHead, { borderBottomColor: theme.colors.border }]}
      >
        <Text style={[styles.fxThDate, { color: theme.colors.textMuted }]}>
          {t('home.date')}
        </Text>
        <Text style={[styles.fxThMatch, { color: theme.colors.textMuted }]}>
          {t('home.match')}
        </Text>
        <Text style={[styles.fxThScore, { color: theme.colors.textMuted }]}>
          {t('home.score')}
        </Text>
      </View>

      {fixtures.map((match) => {
        const played = isMatchPlayed(match);
        return (
          <Pressable
            key={match.id}
            accessibilityRole="button"
            onPress={() => onOpenMatch(match.id)}
            style={[
              styles.fxRow,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <View style={styles.fxDateCol}>
              <Text
                style={[styles.fxDate, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {formatArabicDate(match.date)}
              </Text>
              <Muted>{formatArabicTime(match.date)}</Muted>
            </View>
            <View style={styles.fxMatchCol}>
              <View style={styles.fxTeamLine}>
                <Avatar
                  uri={teamLogo(match.team1Id)}
                  name={teamName(match.team1Id)}
                  size={22}
                />
                <Text
                  style={[styles.fxTeam, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {teamName(match.team1Id)}
                </Text>
              </View>
              <View style={styles.fxTeamLine}>
                <Avatar
                  uri={teamLogo(match.team2Id)}
                  name={teamName(match.team2Id)}
                  size={22}
                />
                <Text
                  style={[styles.fxTeam, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {teamName(match.team2Id)}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.fxScore,
                {
                  color: played
                    ? theme.colors.accent
                    : theme.colors.textMuted,
                },
              ]}
            >
              {played
                ? `${match.team1Score} - ${match.team2Score}`
                : 'vs'}
            </Text>
          </Pressable>
        );
      })}

      <Button
        label={t('home.competitionDetails')}
        variant="ghost"
        onPress={onOpenCompetition}
      />
    </Card>
  );
});

export default function FollowerHomeScreen() {
  const {
    competitions,
    users,
    personalitySectionBg,
    currentUser,
    togglePinnedCompetition,
    shareCards,
    messages,
    featureFlags,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { unreadCountFor } = useNotifications();
  const titleDir = useHomeTitleDir();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const unreadShareCards = useMemo(
    () =>
      currentUser
        ? shareCards.filter((c) => c.recipientId === currentUser.id && !c.read)
            .length
        : 0,
    [shareCards, currentUser]
  );

  const unreadMessages = useMemo(
    () =>
      currentUser
        ? messages.filter((m) => m.recipientId === currentUser.id && !m.read)
            .length
        : 0,
    [messages, currentUser]
  );

  const unreadNotifs = unreadCountFor(currentUser?.id);

  const pinnedIds = currentUser?.pinnedCompetitionIds || [];
  const locationLabel = [currentUser?.city, currentUser?.region]
    .filter(Boolean)
    .join(' · ');

  const homeCompetitions = useMemo(
    () => selectHomeCompetitions(competitions, currentUser),
    [competitions, currentUser]
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return competitions.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.visibleId.toLowerCase().includes(q) ||
        c.venue?.city?.toLowerCase().includes(q) ||
        c.venue?.region?.toLowerCase().includes(q) ||
        c.venue?.name?.toLowerCase().includes(q)
    );
  }, [competitions, query]);

  const isSearching = query.trim().length > 0;

  const upcomingMatch = useMemo(() => {
    return homeCompetitions
      .flatMap((c) => c.matches.map((m) => ({ ...m, competition: c })))
      .filter((m) => new Date(m.date) > new Date())
      .sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )[0];
  }, [homeCompetitions]);

  const competitionsWithStandings = useMemo(
    () =>
      homeCompetitions.filter(
        (c) =>
          c.status === 'active' &&
          c.teams.length > 0 &&
          computeStandings(c).some((row) => row.played > 0)
      ),
    [homeCompetitions]
  );

  const competitionsWithFixtures = useMemo(
    () =>
      homeCompetitions.filter(
        (c) => c.status === 'active' && (c.matches?.length || 0) > 0
      ),
    [homeCompetitions]
  );

  const topPlayers = useMemo(() => {
    const players: CombinedPlayer[] = [];
    const calculateLikes = (p: Player | User) =>
      (['photos', 'videos'] as const).reduce(
        (sum, type) =>
          sum +
          (p.media?.[type]?.reduce((s, item) => s + item.likes.length, 0) || 0),
        0
      );

    homeCompetitions.forEach((comp) => {
      (comp.teams || []).forEach((team) => {
        (team.players || []).forEach((player) => {
          players.push({
            ...player,
            totalLikes: calculateLikes(player),
            teamName: team.name,
            teamLogo: team.logo,
          });
        });
      });
    });

    const homeCities = new Set(
      homeCompetitions
        .map((c) => c.venue?.city?.trim().toLowerCase())
        .filter(Boolean) as string[]
    );

    users
      .filter((u) => userHasRole(u, 'freelancer'))
      .filter((u) => {
        if (!u.city) return homeCities.size === 0;
        return homeCities.has(u.city.trim().toLowerCase());
      })
      .forEach((user) => {
        players.push({
          ...user,
          totalLikes: calculateLikes(user),
          teamName: t('home.freelancerPlayer'),
          isFreelancer: true,
        });
      });

    return players.sort((a, b) => b.totalLikes - a.totalLikes).slice(0, 10);
  }, [homeCompetitions, users, t]);

  return (
    <Screen scroll contentStyle={styles.content} edges={['top', 'left', 'right']}>
      <HomeHeader
        accountHref="/(follower)/settings/account"
        settingsHref="/(follower)/settings"
        pageSubtitle={
          locationLabel
            ? t('home.regionContent', { location: locationLabel })
            : t('home.setCityFromAccount')
        }
      />

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={t('home.searchPlaceholder')}
      />

      {isSearching ? (
        <View style={styles.section}>
          <Subtitle style={[styles.sectionTitle, titleDir]}>{t('home.searchResults')}</Subtitle>
          <Muted style={[styles.sectionTitle, titleDir]}>
            {t('home.searchHint')}
          </Muted>
          {searchResults.length === 0 ? (
            <EmptyState
              title={t('home.noSearch')}
              description={t('home.noSearchDesc')}
              icon="search-outline"
            />
          ) : (
            searchResults.map((comp) => {
              const pinned = pinnedIds.includes(comp.id);
              return (
                <Card key={comp.id} style={styles.searchCard}>
                  <View style={styles.compHeader}>
                    <Pressable
                      style={styles.compTitlePress}
                      onPress={() =>
                        router.push(
                          `/(follower)/competitions/${comp.id}` as any
                        )
                      }
                    >
                      <Text
                        style={[styles.searchTitle, titleDir, { color: theme.colors.text }]}
                      >
                        {comp.name}
                      </Text>
                      <Muted style={[styles.compMeta, titleDir]} numberOfLines={1}>
                        {formatVenueAddress(comp)}
                      </Muted>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => togglePinnedCompetition(comp.id)}
                      style={[
                        styles.pinBtn,
                        {
                          backgroundColor: pinned
                            ? theme.colors.accent
                            : theme.colors.inputBg,
                          borderColor: pinned
                            ? theme.colors.accent
                            : theme.colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={pinned ? 'pin' : 'pin-outline'}
                        size={16}
                        color={
                          pinned
                            ? theme.colors.textInverse
                            : theme.colors.textMuted
                        }
                      />
                      <Text
                        style={[
                          { color: pinned ? theme.colors.textInverse : theme.colors.textMuted, fontSize: 12 },
                          // cairoText applied via home styles where possible
                          { fontFamily: 'Cairo_700Bold', fontWeight: 'normal' as const },
                        ]}
                      >
                        {pinned ? t('home.pinned') : t('home.pin')}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      ) : (
        <>
          <NationalLeagueHomeSection />

          <View style={styles.section}>
            <Subtitle style={[styles.sectionTitle, titleDir]}>{t('home.upcoming')}</Subtitle>
            <Muted style={[styles.sectionTitle, titleDir]}>
              {locationLabel
                ? t('home.upcomingFrom', { location: locationLabel })
                : t('home.upcomingFallback')}
            </Muted>
            {upcomingMatch ? (
              <UpcomingMatchCard
                match={upcomingMatch}
                competition={upcomingMatch.competition}
                onPress={() =>
                  router.push(`/(follower)/matches/${upcomingMatch.id}` as any)
                }
              />
            ) : (
              <EmptyState
                title={t('home.noMatches')}
                description={t('home.noMatchesDesc')}
                icon="football-outline"
                actionLabel={t('home.editAddress')}
                onAction={() =>
                  router.push('/(follower)/settings/account' as any)
                }
              />
            )}
          </View>

          <View style={styles.section}>
            <Subtitle style={[styles.sectionTitle, titleDir]}>{t('home.fixtures')}</Subtitle>
            <Muted style={[styles.sectionTitle, titleDir]}>
              {t('home.fixturesSub')}
            </Muted>
            {competitionsWithFixtures.length === 0 ? (
              <EmptyState
                title={t('home.noFixtures')}
                description={t('home.noFixturesDesc')}
                icon="calendar-outline"
              />
            ) : (
              competitionsWithFixtures.map((comp) => (
                <FixturesTable
                  key={comp.id}
                  competition={comp}
                  pinned={pinnedIds.includes(comp.id)}
                  onTogglePin={() => togglePinnedCompetition(comp.id)}
                  onOpenMatch={(matchId) =>
                    router.push(`/(follower)/matches/${matchId}` as any)
                  }
                  onOpenCompetition={() =>
                    router.push(`/(follower)/competitions/${comp.id}` as any)
                  }
                />
              ))
            )}
          </View>

          <View style={styles.section}>
            <Subtitle style={[styles.sectionTitle, titleDir]}>{t('home.standings')}</Subtitle>
            <Muted style={[styles.sectionTitle, titleDir]}>
              {t('home.standingsSub')}
            </Muted>
            {competitionsWithStandings.length === 0 ? (
              <EmptyState
                title={t('home.noStandings')}
                description={t('home.noStandingsDesc')}
                icon="podium-outline"
              />
            ) : (
              competitionsWithStandings.map((comp) => (
                <StandingsTable
                  key={comp.id}
                  competition={comp}
                  pinned={pinnedIds.includes(comp.id)}
                  onTogglePin={() => togglePinnedCompetition(comp.id)}
                  onOpen={() =>
                    router.push(`/(follower)/competitions/${comp.id}` as any)
                  }
                />
              ))
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.personalityBanner')}
            onPress={() => router.push('/(follower)/personality')}
          >
            <View style={styles.banner}>
              <Image
                source={{ uri: personalitySectionBg }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
              <View
                style={[
                  styles.bannerOverlay,
                  { backgroundColor: theme.colors.overlay },
                ]}
              >
                <Text style={[styles.bannerTitle, titleDir]}>{t('home.personalityBanner')}</Text>
                <Text style={[styles.bannerDesc, titleDir]}>
                  {t('home.personalityBannerDesc')}
                </Text>
              </View>
            </View>
          </Pressable>

          <View style={styles.section}>
            <Subtitle style={[styles.sectionTitle, titleDir]}>{t('home.topPlayers')}</Subtitle>
            {topPlayers.length === 0 ? (
              <EmptyState title={t('home.noPlayers')} icon="people-outline" />
            ) : (
              <FlatList
                horizontal
                data={topPlayers}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
                initialNumToRender={4}
                windowSize={5}
                maxToRenderPerBatch={4}
                removeClippedSubviews
                nestedScrollEnabled
                renderItem={({ item }) => (
                  <PlayerCard
                    item={item}
                    onPress={() =>
                      router.push(`/(follower)/players/${item.id}` as any)
                    }
                  />
                )}
              />
            )}
          </View>

          <View style={styles.section}>
            <Subtitle style={[styles.sectionTitle, titleDir]}>{t('home.explore')}</Subtitle>
            <ListRow
              title={t('home.messages')}
              subtitle={
                unreadMessages > 0
                  ? t('home.messagesSubUnread', { count: unreadMessages })
                  : t('home.messagesSub')
              }
              icon="mail-outline"
              badge={unreadMessages}
              onPress={() => router.push('/(follower)/messages' as any)}
            />
            <ListRow
              title={t('notifications.title')}
              subtitle={
                unreadNotifs > 0
                  ? t('notifications.unreadCount', { count: unreadNotifs })
                  : t('notifications.emptyDesc')
              }
              icon="notifications-outline"
              badge={unreadNotifs}
              onPress={() => router.push('/notifications' as any)}
            />
            <ListRow
              title={t('home.shareCards')}
              subtitle={
                unreadShareCards > 0
                  ? t('home.shareCardsSubUnread', { count: unreadShareCards })
                  : t('home.shareCardsSub')
              }
              icon="mail-unread-outline"
              badge={unreadShareCards}
              onPress={() => router.push('/share-cards' as any)}
            />
            <ListRow
              title={t('home.matches')}
              subtitle={t('home.matchesSub')}
              icon="football-outline"
              onPress={() => router.push('/(follower)/matches' as any)}
            />
            <ListRow
              title={t('home.competitions')}
              subtitle={t('home.competitionsSub')}
              icon="trophy-outline"
              onPress={() => router.push('/(follower)/competitions' as any)}
            />
            <ListRow
              title={t('home.players')}
              subtitle={t('home.playersSub')}
              icon="people-outline"
              onPress={() => router.push('/(follower)/players' as any)}
            />
            {featureFlags.appreciationEnabled ? (
              <ListRow
                title={t('home.certificates')}
                subtitle={t('home.certificatesSub')}
                icon="ribbon-outline"
                onPress={() => router.push('/(follower)/certificates' as any)}
              />
            ) : null}
            <ListRow
              title={t('home.yourAddress')}
              subtitle={locationLabel || t('home.setCity')}
              icon="location-outline"
              onPress={() =>
                router.push('/(follower)/settings/account' as any)
              }
            />
            <ListRow
              title={t('home.settings')}
              subtitle={t('home.settingsSub')}
              icon="settings-outline"
              onPress={() => router.push('/(follower)/settings' as any)}
            />
          </View>

          <Card style={styles.highlightCard}>
            <Subtitle style={[styles.sectionTitle, titleDir]}>{t('home.highlightsCard')}</Subtitle>
            <Muted style={[styles.sectionTitle, titleDir]}>
              {t('home.highlightsCardDesc')}
            </Muted>
            <Button
              label={t('home.viewHighlights')}
              variant="secondary"
              onPress={() => router.push('/(follower)/highlights')}
              style={styles.highlightBtn}
            />
          </Card>
        </>
      )}

      <AccountSocialStats user={currentUser} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 20 },
  section: { gap: 10, width: '100%' },
  sectionTitle: {
    width: '100%',
  },
  standingsCard: { gap: 8 },
  fixturesCard: { gap: 8 },
  matchCard: { alignItems: 'center', gap: 6 },
  searchCard: { gap: 8 },
  highlightCard: { gap: 10 },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 6,
  },
  teamCol: { alignItems: 'center', gap: 6, flex: 1 },
  teamName: { fontWeight: '700', fontSize: 13, textAlign: 'center' },
  vs: { fontSize: 18, fontWeight: '800' },
  banner: {
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bannerOverlay: { padding: 14, gap: 4 },
  bannerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  bannerDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  playerCard: {
    width: 88,
  },
  playerCardInner: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  playerRole: {
    ...cairoText('semiBold'),
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    width: '100%',
  },
  highlightBtn: { alignSelf: 'flex-start', minWidth: 160 },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  compTitlePress: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  compTitle: {
    width: '100%',
  },
  compMeta: {
    width: '100%',
  },
  searchTitle: {
    fontWeight: '800',
    fontSize: 15,
    width: '100%',
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fxHead: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 6,
    gap: 6,
  },
  fxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 6,
  },
  fxThDate: { width: 78, fontSize: 11, fontWeight: '700', textAlign: 'left' },
  fxThMatch: { flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'left' },
  fxThScore: { width: 52, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  fxDateCol: { width: 78, gap: 2 },
  fxDate: { fontSize: 11, fontWeight: '700', textAlign: 'left' },
  fxMatchCol: { flex: 1, gap: 6 },
  fxTeamLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fxTeam: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'left',
  },
  fxScore: {
    width: 52,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 6,
    gap: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    gap: 4,
  },
  thRank: { width: 22, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  thTeam: { flex: 1.8, fontSize: 11, fontWeight: '700', textAlign: 'left' },
  th: { width: 28, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  tdRank: { width: 22, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  teamCell: {
    flex: 1.8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tdTeam: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'left',
  },
  td: { width: 28, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  tdPoints: {
    width: 28,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
});

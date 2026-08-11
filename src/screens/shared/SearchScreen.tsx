import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import {
  StackTopChrome,
  stackTopChromePad,
} from '@/components/layout/StackTopChrome';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import {
  ShareTargetModal,
  TinyShareButton,
  type ContentSharePayload,
} from '@/components/share/ShareTargetModal';
import {
  Card,
  Muted,
  SearchBar,
} from '@/components/ui';
import { useListChrome } from '@/hooks/useListChrome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userHasRole } from '@/utils/roles';

type Hit = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind: string;
  joinShare?: ContentSharePayload;
};

/** بحث شامل في محتوى التطبيق. */
export default function SearchScreen() {
  const {
    currentUser,
    loading,
    users,
    competitions,
    comments,
    referees,
    routeForRole,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listChrome = useListChrome({ hasTabBar: false });
  const topPad = stackTopChromePad(insets.top);
  const [query, setQuery] = useState('');
  const [sharePayload, setSharePayload] = useState<ContentSharePayload | null>(
    null
  );

  const effectiveRole = currentUser
    ? currentUser.activeRole || currentUser.role
    : undefined;
  const homeHref = effectiveRole ? routeForRole(effectiveRole) : '/';
  const isOrganizer = effectiveRole === 'organizer';

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [] as Hit[];

    const results: Hit[] = [];
    const role = effectiveRole;

    const competitionHref = (id: string) => {
      if (role === 'organizer') return `/(organizer)/competitions/${id}`;
      if (role === 'superadmin') return `/admin/competitions/${id}`;
      if (role === 'follower') return `/(follower)/competitions/${id}`;
      return '/forums';
    };

    const playerHref = (id: string) => {
      if (role === 'follower') return `/(follower)/players/${id}`;
      if (role === 'freelancer' && id === currentUser?.id) return '/shares';
      return '/forums';
    };

    const matchHref = (id: string) => {
      if (role === 'follower') return `/(follower)/matches/${id}`;
      return competitionHref(
        competitions.find((c) => c.matches.some((m) => m.id === id))?.id || ''
      );
    };

    competitions.forEach((c) => {
      if (
        role === 'organizer' &&
        currentUser &&
        c.organizerId !== currentUser.id
      ) {
        return;
      }
      if (
        c.name.toLowerCase().includes(q) ||
        c.visibleId.toLowerCase().includes(q) ||
        c.venue?.city?.toLowerCase().includes(q)
      ) {
        results.push({
          id: `comp-${c.id}`,
          title: c.name,
          subtitle: `${t('screens.competitions')} · ${t('screens.teamsMatches', {
            teams: c.teams.length,
            matches: c.matches.length,
          })}`,
          href: competitionHref(c.id),
          kind: t('screens.competitions'),
        });
      }
      c.teams.forEach((team) => {
        if (team.name.toLowerCase().includes(q)) {
          results.push({
            id: `team-${team.id}`,
            title: team.name,
            subtitle: t('searchUi.inCompetition', { name: c.name }),
            href: competitionHref(c.id),
            kind: t('searchUi.kindTeam'),
          });
        }
        team.players.forEach((p) => {
          if (
            p.name.toLowerCase().includes(q) ||
            String(p.jerseyNumber).includes(q)
          ) {
            const matched = users.find(
              (u) =>
                u.id === p.id ||
                (p.email && u.email === p.email) ||
                u.name.trim().toLowerCase() === p.name.trim().toLowerCase()
            );
            results.push({
              id: `player-${p.id}`,
              title: p.name,
              subtitle: `${team.name} · ${p.position}`,
              href: playerHref(p.id),
              kind: t('searchUi.kindPlayer'),
              joinShare: isOrganizer
                ? {
                    kind: 'join_request',
                    competitionId: c.id,
                    competitionName: c.name,
                    teamId: team.id,
                    teamName: team.name,
                    position: p.position,
                    presetRecipientId: matched?.id,
                    presetRecipientName: matched?.name || p.name,
                    presetRecipientKind: 'user',
                    body: t('shareCards.defaultJoinNote', {
                      name: matched?.name || p.name,
                    }),
                  }
                : undefined,
            });
          }
        });
      });
      c.matches.forEach((m) => {
        const t1 = c.teams.find((x) => x.id === m.team1Id)?.name || '?';
        const t2 = c.teams.find((x) => x.id === m.team2Id)?.name || '?';
        const label = `${t1} ${t('screens.vs')} ${t2}`;
        if (label.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
          results.push({
            id: `match-${m.id}`,
            title: label,
            subtitle: t('searchUi.matchIn', { name: c.name }),
            href: matchHref(m.id),
            kind: t('searchUi.kindMatch'),
          });
        }
      });
    });

    users.forEach((u) => {
      const blob = `${u.name} ${u.handle || ''} ${u.email} ${u.bio || ''}`.toLowerCase();
      if (!blob.includes(q)) return;
      results.push({
        id: `user-${u.id}`,
        title: u.name,
        subtitle: `${u.handle} · ${u.visibleId} · ${u.role}`,
        href: `/profile/${u.id}`,
        kind: t('settings.account'),
        joinShare:
          isOrganizer &&
          (userHasRole(u, 'freelancer') || userHasRole(u, 'follower'))
            ? {
                kind: 'join_request',
                presetRecipientId: u.id,
                presetRecipientName: u.name,
                presetRecipientKind: 'user',
                body: t('shareCards.defaultJoinNote', { name: u.name }),
              }
            : undefined,
      });
      u.analysisContent.forEach((a) => {
        if (
          a.title.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q)
        ) {
          results.push({
            id: `analysis-${a.id}`,
            title: a.title,
            subtitle: `${t('screens.typeAnalysis')} · ${u.name}`,
            href: role === 'follower' ? `/(follower)/analysis/${a.id}` : '/unique',
            kind: t('screens.typeAnalysis'),
          });
        }
      });
      u.posts.forEach((p) => {
        if (p.text.toLowerCase().includes(q)) {
          results.push({
            id: `post-${p.id}`,
            title: p.text.slice(0, 60),
            subtitle: `${t('menu.shares')} · ${u.name}`,
            href: `/profile/${u.id}`,
            kind: t('menu.shares'),
          });
        }
      });
    });

    comments.forEach((c) => {
      if (c.text.toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q)) {
        results.push({
          id: `comment-${c.id}`,
          title: c.text.slice(0, 70),
          subtitle: `${t('menu.forums')} · ${c.authorName}`,
          href: '/forums',
          kind: t('menu.forums'),
        });
      }
    });

    referees.forEach((r) => {
      if (r.name.toLowerCase().includes(q) || r.city?.toLowerCase().includes(q)) {
        results.push({
          id: `ref-${r.id}`,
          title: r.name,
          subtitle: t('searchUi.refereeRole', { role: r.role }),
          href: role === 'superadmin' ? '/admin/referees' : homeHref,
          kind: t('searchUi.kindReferee'),
        });
      }
    });

    return results.slice(0, 60);
  }, [
    query,
    competitions,
    users,
    comments,
    referees,
    currentUser,
    effectiveRole,
    homeHref,
    isOrganizer,
    t,
  ]);

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;

  return (
    <View style={styles.root}>
      <StackTopChrome />
      <Screen keyboard hasTabBar={false}>
        <FlatList
          style={{ flex: 1 }}
          data={hits}
          keyExtractor={(item) => item.id}
          {...listChrome}
          contentContainerStyle={[
            styles.list,
            { paddingTop: topPad },
            listChrome.contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <Muted>{t('searchUi.subtitle')}</Muted>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder={t('searchUi.placeholder')}
                autoFocus
              />
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title={query ? t('searchUi.noResults') : t('searchUi.start')}
              description={
                query ? t('screens.tryOtherTeam') : t('searchUi.subtitle')
              }
              icon="search-outline"
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Pressable
                  onPress={() => router.push(item.href as any)}
                  accessibilityRole="button"
                  style={styles.hitMain}
                >
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: theme.colors.accentSoft },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.colors.accent,
                        fontWeight: '800',
                        fontSize: 11,
                      }}
                    >
                      {item.kind}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[styles.title, { color: theme.colors.text }]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Muted>{item.subtitle}</Muted>
                  </View>
                </Pressable>
                {item.joinShare ? (
                  <TinyShareButton
                    onPress={() => setSharePayload(item.joinShare!)}
                    accessibilityLabel={t('shareCards.sendJoinCard')}
                  />
                ) : null}
              </View>
            </Card>
          )}
        />
      </Screen>
      <ShareTargetModal
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingTop: 12, gap: 10, paddingBottom: 120 },
  header: { gap: 10, marginBottom: 8 },
  card: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hitMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  title: { fontWeight: '800', textAlign: 'left' },
});

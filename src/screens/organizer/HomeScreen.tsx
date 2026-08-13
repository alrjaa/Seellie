import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Screen } from '@/components/layout/Screen';
import { HomeHeader } from '@/components/layout/HomeHeader';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import { Card, Muted, Subtitle } from '@/components/ui';
import {
  ORGANIZER_MODULES,
  type OrganizerModule,
} from './modules';
import { userHasRole } from '@/utils/roles';
import { flowDirection } from '@/theme/direction';

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useAppTheme();
  const { isRTL } = useTranslation();
  const align = (isRTL ? 'right' : 'left') as 'left' | 'right';
  return (
    <Card
      style={[
        styles.statCard,
        flowDirection(isRTL),
      ]}
    >
      <View style={styles.statHeader}>
        <Muted style={styles.statLabel}>{label}</Muted>
        <Ionicons name={icon} size={16} color={theme.colors.textMuted} />
      </View>
      <Text
        {...({ physicalAlign: true } as object)}
        style={[
          styles.statValue,
          {
            color: theme.colors.accent,
            textAlign: align,
            writingDirection: isRTL ? 'rtl' : 'ltr',
          },
        ]}
      >
        {value}
      </Text>
    </Card>
  );
}

function ModuleCard({
  module,
  title,
  description,
  onPress,
}: {
  module: OrganizerModule;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const { isRTL } = useTranslation();
  const align = (isRTL ? 'right' : 'left') as 'left' | 'right';
  const writingDirection = (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.moduleCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.85 : 1,
          ...flowDirection(isRTL),
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: theme.colors.accentSoft },
        ]}
      >
        <Ionicons name={module.icon} size={20} color={theme.colors.accent} />
      </View>
      <Text
        {...({ physicalAlign: true } as object)}
        style={[
          styles.moduleTitle,
          {
            color: theme.colors.text,
            textAlign: align,
            writingDirection,
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        {...({ physicalAlign: true } as object)}
        style={[
          styles.moduleDesc,
          {
            color: theme.colors.textMuted,
            textAlign: align,
            writingDirection,
          },
        ]}
        numberOfLines={2}
      >
        {description}
      </Text>
    </Pressable>
  );
}

export default function OrganizerHomeScreen() {
  const {
    currentUser,
    loading,
    competitions,
    users,
    messages,
    offers,
    routeForRole,
  } = useTournament();
  const router = useRouter();
  const { t } = useTranslation();

  const myCompetitions = useMemo(() => {
    if (!currentUser) return [];
    return competitions.filter((c) => c.organizerId === currentUser.id);
  }, [competitions, currentUser]);

  const stats = useMemo(() => {
    const teams = myCompetitions.reduce((n, c) => n + c.teams.length, 0);
    const matches = myCompetitions.reduce((n, c) => n + c.matches.length, 0);
    const freelancers = users.filter((u) => userHasRole(u, 'freelancer')).length;
    const unread = messages.filter(
      (m) => m.recipientId === currentUser?.id && !m.read
    ).length;
    const pendingOffers = offers.filter((o) => o.status === 'pending').length;
    return {
      competitions: myCompetitions.length,
      teams,
      matches,
      freelancers,
      unread,
      pendingOffers,
    };
  }, [myCompetitions, users, messages, offers, currentUser]);

  const groups = useMemo(() => {
    const map = new Map<OrganizerModule['group'], OrganizerModule[]>();
    ORGANIZER_MODULES.forEach((m) => {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    });
    return Array.from(map.entries());
  }, []);

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'organizer') {
    return <Redirect href={routeForRole(active) as any} />;
  }

  return (
    <Screen scroll contentStyle={styles.content} edges={['top', 'left', 'right']} density="dashboard">
      <HomeHeader
        accountHref="/(organizer)/settings"
        pageTitle={t('organizer.dashboard.title')}
        pageSubtitle={t('organizer.dashboard.subtitle')}
      />

      <View style={styles.statsGrid}>
        <StatCard
          label={t('organizer.stats.competitions')}
          value={stats.competitions}
          icon="trophy"
        />
        <StatCard
          label={t('organizer.stats.teams')}
          value={stats.teams}
          icon="people"
        />
        <StatCard
          label={t('organizer.stats.matches')}
          value={stats.matches}
          icon="calendar"
        />
        <StatCard
          label={t('organizer.stats.freelancers')}
          value={stats.freelancers}
          icon="football"
        />
        <StatCard
          label={t('organizer.stats.unreadMessages')}
          value={stats.unread}
          icon="mail-unread"
        />
        <StatCard
          label={t('organizer.stats.pendingOffers')}
          value={stats.pendingOffers}
          icon="paper-plane"
        />
      </View>

      {groups.map(([group, modules]) => (
        <View key={group} style={styles.section}>
          <Subtitle>{t(`organizer.groups.${group}`)}</Subtitle>
          <View style={styles.modulesGrid}>
            {modules.map((module) => (
              <View key={module.key} style={styles.moduleCell}>
                <ModuleCard
                  module={module}
                  title={t(`organizer.modules.${module.key}.title`)}
                  description={t(`organizer.modules.${module.key}.description`)}
                  onPress={() => router.push(module.href as any)}
                />
              </View>
            ))}
          </View>
        </View>
      ))}

      <AccountSocialStats user={currentUser} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 16, paddingBottom: 40 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    maxWidth: '48%',
    minWidth: 0,
    gap: 6,
  },
  statHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  statLabel: {
    flexShrink: 1,
  },
  statValue: { fontSize: 26, fontWeight: '900', width: '100%' },
  section: { gap: 10 },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleCell: {
    flexGrow: 1,
    flexBasis: '47%',
    maxWidth: '48%',
    minWidth: 0,
  },
  moduleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    minHeight: 118,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    alignSelf: 'flex-start',
  },
  moduleTitle: { fontSize: 12, fontWeight: '800', width: '100%' },
  moduleDesc: { fontSize: 10, lineHeight: 14, width: '100%' },
});

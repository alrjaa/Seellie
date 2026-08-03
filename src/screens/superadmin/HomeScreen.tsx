import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { HomeHeader } from '@/components/layout/HomeHeader';
import { Card, Muted, Subtitle } from '@/components/ui';
import { ADMIN_MODULES, type AdminModule } from './modules';
import { useResponsive } from '@/hooks/useResponsive';

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
  return (
    <Card style={styles.statCard}>
      <View style={styles.statHeader}>
        <Muted>{label}</Muted>
        <Ionicons name={icon} size={16} color={theme.colors.textMuted} />
      </View>
      <Text style={[styles.statValue, { color: theme.colors.primary }]}>
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
  module: AdminModule;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.moduleCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}
      >
        <Ionicons name={module.icon} size={20} color={theme.colors.primary} />
      </View>
      <Text style={[styles.moduleTitle, { color: theme.colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <Text
        style={[styles.moduleDesc, { color: theme.colors.textMuted }]}
        numberOfLines={2}
      >
        {description}
      </Text>
    </Pressable>
  );
}

export default function SuperAdminDashboardScreen() {
  const { users, competitions, referees, messages } = useTournament();
  const router = useRouter();
  const { columns } = useResponsive();
  const { t, isRTL } = useTranslation();
  const gridCols = Math.min(Math.max(columns + 1, 2), 3);

  const stats = useMemo(() => {
    const organizers = users.filter((u) => u.role === 'organizer').length;
    const followers = users.filter((u) => u.role === 'follower').length;
    const freelancers = users.filter((u) => u.role === 'freelancer').length;
    const unread = messages.filter((m) => !m.read).length;
    return {
      organizers,
      competitions: competitions.length,
      followers,
      freelancers,
      referees: referees.length,
      unread,
    };
  }, [users, competitions, referees, messages]);

  const groups = useMemo(() => {
    const map = new Map<AdminModule['group'], AdminModule[]>();
    ADMIN_MODULES.forEach((m) => {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    });
    return Array.from(map.entries());
  }, []);

  return (
    <Screen scroll contentStyle={styles.content} edges={['top', 'left', 'right']}>
      <HomeHeader
        accountHref="/(superadmin)/settings"
        pageTitle={t('superadmin.dashboard.title')}
        pageSubtitle={t('superadmin.dashboard.subtitle')}
      />

      <View style={styles.statsGrid}>
        <StatCard
          label={t('superadmin.stats.organizers')}
          value={stats.organizers}
          icon="briefcase"
        />
        <StatCard
          label={t('superadmin.stats.competitions')}
          value={stats.competitions}
          icon="trophy"
        />
        <StatCard
          label={t('superadmin.stats.followers')}
          value={stats.followers}
          icon="people"
        />
        <StatCard
          label={t('superadmin.stats.freelancers')}
          value={stats.freelancers}
          icon="football"
        />
        <StatCard
          label={t('superadmin.stats.referees')}
          value={stats.referees}
          icon="person"
        />
        <StatCard
          label={t('superadmin.stats.unreadMessages')}
          value={stats.unread}
          icon="mail-unread"
        />
      </View>

      {groups.map(([group, modules]) => (
        <View key={group} style={styles.section}>
          <Subtitle
            style={{
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
              width: '100%',
            }}
          >
            {t(`superadmin.groups.${group}`)}
          </Subtitle>
          <View style={styles.modulesGrid}>
            {modules.map((module) => (
              <View
                key={module.key}
                style={{ width: `${100 / gridCols - 1.5}%` as any, minWidth: 140, flexGrow: 1 }}
              >
                <ModuleCard
                  module={module}
                  title={t(`superadmin.modules.${module.key}.title`)}
                  description={t(`superadmin.modules.${module.key}.description`)}
                  onPress={() => router.push(module.href as any)}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 16, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexGrow: 1, minWidth: 140, gap: 6 },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statValue: { fontSize: 26, fontWeight: '900', textAlign: 'left' },
  section: { gap: 10 },
  modulesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
  },
  moduleTitle: { fontSize: 14, fontWeight: '800', textAlign: 'left' },
  moduleDesc: { fontSize: 11, lineHeight: 16, textAlign: 'left' },
});

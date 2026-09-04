import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useTournament } from '@/providers/TournamentProvider';
import {
  useNotifications,
  type AppNotification,
} from '@/providers/NotificationsProvider';
import { Screen } from '@/components/layout/Screen';
import {
  StackTopChrome,
  stackTopChromePad,
} from '@/components/layout/StackTopChrome';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Button, Card, Muted, Subtitle, Title } from '@/components/ui';
import { formatArabicDate } from '@/utils';

function kindIcon(
  kind: AppNotification['kind']
): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'follow':
      return 'person-add-outline';
    case 'message':
      return 'mail-outline';
    case 'offer':
      return 'paper-plane-outline';
    case 'media':
      return 'images-outline';
    case 'appreciation':
      return 'ribbon-outline';
    case 'announcement':
      return 'megaphone-outline';
    default:
      return 'notifications-outline';
  }
}

function resolveCompetitionLabel(
  item: AppNotification,
  competitions: { id: string; name: string; logo?: string }[]
) {
  if (item.competitionName?.trim()) return item.competitionName.trim();
  if (item.competitionId) {
    const hit = competitions.find((c) => c.id === item.competitionId);
    if (hit?.name) return hit.name;
  }
  return '';
}

function resolveCompetitionLogo(
  item: AppNotification,
  competitions: { id: string; name: string; logo?: string }[]
) {
  if (item.competitionLogo?.trim()) return item.competitionLogo.trim();
  if (item.competitionId) {
    const hit = competitions.find((c) => c.id === item.competitionId);
    if (hit?.logo) return hit.logo;
  }
  return undefined;
}

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, routeForRole, competitions } = useTournament();
  const { forUser, markRead, markAllRead, clearAll } = useNotifications();
  const topPad = stackTopChromePad(insets.top);
  const userId = currentUser?.id;
  const [opened, setOpened] = useState<AppNotification | null>(null);

  const data = useMemo(() => forUser(userId), [forUser, userId]);
  const unreadCount = useMemo(
    () => data.filter((n) => !n.read).length,
    [data]
  );

  const openedCompetition = opened
    ? resolveCompetitionLabel(opened, competitions)
    : '';
  const openedLogo = opened
    ? resolveCompetitionLogo(opened, competitions)
    : undefined;

  const goHome = () => {
    if (currentUser) {
      router.replace(
        routeForRole(currentUser.activeRole || currentUser.role) as any
      );
      return;
    }
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.root}>
      <StackTopChrome />
      <Screen
        hasTabBar={false}
        contentStyle={{ ...styles.content, paddingTop: topPad }}
      >
        <Title>{t('notifications.title')}</Title>
        <Muted>
          {unreadCount > 0
            ? t('notifications.unreadCount', { count: unreadCount })
            : t('notifications.allRead')}
        </Muted>

        <View
          style={[
            styles.actions,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <Button
            label={t('notifications.markAllRead')}
            variant="secondary"
            onPress={() => markAllRead(userId)}
            style={{ flex: 1 }}
            disabled={unreadCount === 0}
          />
          <Button
            label={t('notifications.clear')}
            variant="outline"
            onPress={() => clearAll(userId)}
            style={{ flex: 1 }}
            disabled={data.length === 0}
          />
        </View>

        <FlatList
          style={{ flex: 1 }}
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title={t('notifications.empty')}
              description={t('notifications.emptyDesc')}
              icon="notifications-outline"
            />
          }
          renderItem={({ item }) => {
            const competitionLabel = resolveCompetitionLabel(
              item,
              competitions
            );
            const competitionLogo = resolveCompetitionLogo(item, competitions);
            return (
              <Pressable
                onPress={() => {
                  markRead(item.id, userId);
                  if (item.kind === 'announcement') {
                    setOpened(item);
                    return;
                  }
                  if (item.href) router.push(item.href as any);
                }}
              >
                <Card
                  style={[
                    styles.card,
                    !item.read && {
                      borderColor: theme.colors.accent,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.row,
                      { flexDirection: isRTL ? 'row-reverse' : 'row' },
                    ]}
                  >
                    {item.kind === 'announcement' ? (
                      <Avatar
                        uri={competitionLogo}
                        name={competitionLabel || item.title}
                        size={40}
                      />
                    ) : (
                      <View
                        style={[
                          styles.iconWrap,
                          { backgroundColor: theme.colors.accentSoft },
                        ]}
                      >
                        <Ionicons
                          name={kindIcon(item.kind)}
                          size={18}
                          color={theme.colors.accent}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 4 }}>
                      {item.kind === 'announcement' && competitionLabel ? (
                        <Text
                          style={[
                            styles.competitionLabel,
                            {
                              color: theme.colors.accent,
                              textAlign: isRTL ? 'right' : 'left',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {t('notifications.fromCompetition', {
                            name: competitionLabel,
                          })}
                        </Text>
                      ) : null}
                      <Subtitle>{item.title}</Subtitle>
                      <Muted numberOfLines={3}>{item.body}</Muted>
                      <Muted>
                        {formatArabicDate(new Date(item.createdAt))}
                        {!item.read ? ` · ${t('notifications.new')}` : ''}
                      </Muted>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />

        <Button
          label={t('notifications.backHome')}
          variant="primary"
          onPress={goHome}
        />
      </Screen>

      <Modal
        visible={!!opened}
        transparent
        animationType="fade"
        onRequestClose={() => setOpened(null)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setOpened(null)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Pressable
            style={[
              styles.modal,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
          >
            {opened ? (
              <View style={{ gap: 10 }}>
                <Title>{t('notifications.alertDetailTitle')}</Title>
                {openedCompetition ? (
                  <View
                    style={[
                      styles.competitionBadge,
                      {
                        backgroundColor: theme.colors.accentSoft,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                      },
                    ]}
                  >
                    <Avatar
                      uri={openedLogo}
                      name={openedCompetition}
                      size={36}
                    />
                    <Text
                      style={[
                        styles.competitionBadgeText,
                        {
                          color: theme.colors.accent,
                          textAlign: isRTL ? 'right' : 'left',
                        },
                      ]}
                    >
                      {t('notifications.fromCompetition', {
                        name: openedCompetition,
                      })}
                    </Text>
                  </View>
                ) : null}
                <Subtitle>{opened.title}</Subtitle>
                <Text
                  style={[styles.detailBody, { color: theme.colors.text }]}
                >
                  {opened.body}
                </Text>
                <Muted>{formatArabicDate(new Date(opened.createdAt))}</Muted>
                <Button
                  label={t('common.close')}
                  onPress={() => setOpened(null)}
                />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 12, flex: 1, paddingBottom: 16 },
  actions: { gap: 8 },
  list: { gap: 10, paddingBottom: 16, flexGrow: 1 },
  card: { gap: 6 },
  row: { gap: 10, alignItems: 'flex-start' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  competitionLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  competitionBadge: {
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  competitionBadgeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  detailBody: {
    fontSize: 15,
    lineHeight: 22,
  },
});

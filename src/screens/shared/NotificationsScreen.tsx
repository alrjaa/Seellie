import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
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
import { Button, Card, Muted, Subtitle, Title } from '@/components/ui';
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
    default:
      return 'notifications-outline';
  }
}

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, routeForRole } = useTournament();
  const { forUser, markRead, markAllRead, clearAll } = useNotifications();
  const topPad = stackTopChromePad(insets.top);
  const userId = currentUser?.id;

  const data = useMemo(() => forUser(userId), [forUser, userId]);
  const unreadCount = useMemo(
    () => data.filter((n) => !n.read).length,
    [data]
  );

  const goHome = () => {
    if (currentUser) {
      router.replace(routeForRole(currentUser.role) as any);
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
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                markRead(item.id, userId);
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
                  <View style={{ flex: 1, gap: 4 }}>
                    <Subtitle>{item.title}</Subtitle>
                    <Muted>{item.body}</Muted>
                    <Muted>
                      {formatArabicDate(new Date(item.createdAt))}
                      {!item.read ? ` · ${t('notifications.new')}` : ''}
                    </Muted>
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
        />

        <Button
          label={t('notifications.backHome')}
          variant="primary"
          onPress={goHome}
        />
      </Screen>
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
});

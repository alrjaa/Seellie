import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useTournament, type Message } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button, Card, Input, Muted, Subtitle } from '@/components/ui';
import { formatArabicDate } from '@/utils';
import { isSupabaseConfigured } from '@/services/supabase';
import {
  findSuperadminProfile,
  isUuid,
} from '@/services/supabase-messages';
import {
  startForegroundInterval,
  SYNC_FALLBACK_MS,
} from '@/services/sync-engine';

const MessageRow = memo(function MessageRow({
  item,
  onPress,
}: {
  item: Message;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${item.subject} — ${item.senderName}`}
      accessibilityState={{ selected: !item.read }}
    >
      <Card
        style={
          !item.read
            ? { ...styles.msgCard, borderColor: theme.colors.accent }
            : styles.msgCard
        }
      >
        <View style={styles.row}>
          <Avatar uri={item.senderAvatar} name={item.senderName} size={40} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.subject, { color: theme.colors.text }]}>
              {item.subject}
            </Text>
            <Muted>{item.senderName}</Muted>
            <Text
              style={[styles.body, { color: theme.colors.textMuted }]}
              numberOfLines={3}
            >
              {item.body}
            </Text>
            <Muted>{formatArabicDate(item.timestamp)}</Muted>
          </View>
          {!item.read ? (
            <View
              style={[styles.dot, { backgroundColor: theme.colors.accent }]}
            />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
});

export default function MessagesScreen() {
  const {
    currentUser,
    loading,
    messages,
    markMessageAsRead,
    routeForRole,
    refreshCloudMessages,
    sendMessage,
  } = useTournament();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [subject, setSubject] = useState(() => t('messages.support.defaultSubject'));
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [admin, setAdmin] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const cloudOk = !!currentUser && isUuid(currentUser.id);
  const defaultSubject = t('messages.support.defaultSubject');
  const supportPrefix = t('messages.support.subjectPrefix');

  useFocusEffect(
    useCallback(() => {
      if (!currentUser?.id || !cloudOk || !isSupabaseConfigured()) {
        return;
      }
      // FIX-02: Realtime (provider) is primary. Focus refresh + slow fallback only.
      void refreshCloudMessages();
      const stopPoll = startForegroundInterval(
        SYNC_FALLBACK_MS.messagesDegraded,
        () => {
          void refreshCloudMessages();
        }
      );
      return () => stopPoll();
    }, [currentUser?.id, cloudOk, refreshCloudMessages])
  );

  useEffect(() => {
    if (!cloudOk || !isSupabaseConfigured()) {
      setAdmin(null);
      return;
    }
    let cancelled = false;
    void findSuperadminProfile().then((hit) => {
      if (!cancelled) setAdmin(hit);
    });
    return () => {
      cancelled = true;
    };
  }, [cloudOk, currentUser?.id]);

  const inbox = useMemo(
    () =>
      currentUser
        ? messages
            .filter((m) => m.recipientId === currentUser.id)
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            )
        : [],
    [messages, currentUser]
  );

  const unread = useMemo(
    () => inbox.filter((m) => !m.read).length,
    [inbox]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshCloudMessages();
    if (cloudOk) {
      const hit = await findSuperadminProfile();
      setAdmin(hit);
    }
    setRefreshing(false);
  }, [refreshCloudMessages, cloudOk]);

  const onSendSupport = useCallback(async () => {
    if (sending) return;
    if (!cloudOk) {
      toast({
        variant: 'destructive',
        title: t('messages.support.localAccountTitle'),
        description: t('messages.support.localAccountDesc'),
      });
      return;
    }
    let target = admin;
    if (!target) {
      target = await findSuperadminProfile();
      setAdmin(target);
    }
    if (!target) {
      toast({
        variant: 'destructive',
        title: t('messages.support.adminUnavailableTitle'),
        description: t('messages.support.adminUnavailableDesc'),
      });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast({
        variant: 'destructive',
        title: t('messages.support.incompleteTitle'),
        description: t('messages.support.incompleteDesc'),
      });
      return;
    }
    setSending(true);
    try {
      const trimmed = subject.trim();
      const ok = await sendMessage({
        recipientId: target.id,
        subject: trimmed.startsWith(supportPrefix)
          ? trimmed
          : `${supportPrefix} ${trimmed}`,
        body: body.trim(),
      });
      if (ok) {
        setBody('');
        setSubject(defaultSubject);
        setSupportOpen(false);
      }
    } finally {
      setSending(false);
    }
  }, [
    sending,
    cloudOk,
    admin,
    subject,
    body,
    sendMessage,
    toast,
    t,
    supportPrefix,
    defaultSubject,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageRow item={item} onPress={() => markMessageAsRead(item.id)} />
    ),
    [markMessageAsRead]
  );

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'follower') {
    return <Redirect href={routeForRole(active) as any} />;
  }

  return (
    <Screen keyboard>
      <FlatList
        data={inbox}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            accessibilityLabel={t('common.refresh')}
            title={t('common.refresh')}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 8 }}>
            <Muted>
              {cloudOk
                ? t('messages.support.cloudAccountOk', {
                    email: currentUser.email,
                  })
                : t('messages.support.localAccountBanner')}
            </Muted>
            <Muted>
              {unread > 0
                ? t('home.messagesSubUnread', { count: unread })
                : t('home.messagesSub')}
            </Muted>

            <Card style={{ gap: 10 }}>
              <Subtitle>{t('messages.support.cardTitle')}</Subtitle>
              <Muted>{t('messages.support.cardHint')}</Muted>
              {admin ? (
                <Muted>
                  {t('messages.support.adminName', { name: admin.name })}
                </Muted>
              ) : cloudOk ? (
                <Muted>{t('messages.support.adminSearching')}</Muted>
              ) : null}
              {!supportOpen ? (
                <Button
                  label={t('messages.support.writeButton')}
                  onPress={() => setSupportOpen(true)}
                  disabled={!cloudOk}
                />
              ) : (
                <>
                  <Input
                    label={t('messages.support.subjectLabel')}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder={defaultSubject}
                  />
                  <Input
                    label={t('messages.support.bodyLabel')}
                    value={body}
                    onChangeText={setBody}
                    multiline
                    placeholder={t('messages.support.bodyPlaceholder')}
                  />
                  <View style={styles.actions}>
                    <Button
                      label={t('common.cancel')}
                      variant="ghost"
                      onPress={() => {
                        setSupportOpen(false);
                        setBody('');
                        setSubject(defaultSubject);
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label={
                        sending
                          ? t('common.loading')
                          : t('messages.support.sendButton')
                      }
                      onPress={() => void onSendSupport()}
                      disabled={sending || !cloudOk}
                      loading={sending}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              )}
            </Card>

            <Button
              label={t('messages.support.refreshInbox')}
              variant="outline"
              onPress={() => void onRefresh()}
            />
            <Subtitle>{t('messages.support.inboxTitle')}</Subtitle>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('home.messagesEmpty')}
            description={t('home.messagesEmptyDesc')}
            icon="mail-outline"
          />
        }
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  msgCard: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  subject: { fontWeight: '800', textAlign: 'left' },
  body: {
    textAlign: 'left',
    lineHeight: 18,
    fontSize: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8 },
});

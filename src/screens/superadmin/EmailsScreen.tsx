import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTournament, type Message } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Avatar,
  Button,
  Card,
  Input,
  Muted,
  SearchBar,
  Subtitle,
  Title,
} from '@/components/ui';
import { formatArabicDate, normalizeEmail } from '@/utils';
import { matchesSearchQuery } from '@/utils/search';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import {
  listRecentProfiles,
  searchProfiles,
} from '@/services/supabase-share';
import {
  findProfileIdByEmail,
  getCloudSessionEmail,
  isUuid,
} from '@/services/supabase-messages';
import { useToast } from '@/providers/ToastProvider';

type SentEntry = Message & { localSent?: boolean };

type RecipientChip = {
  id: string;
  name: string;
  email?: string;
};

export default function EmailsScreen() {
  const { currentUser, users, sendMessage, messages, refreshCloudMessages, logout } =
    useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [toId, setToId] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [localSent, setLocalSent] = useState<SentEntry[]>([]);
  const [query, setQuery] = useState('');
  const [cloudHits, setCloudHits] = useState<RecipientChip[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState('');
  const cloudAdmin = !!currentUser && isUuid(currentUser.id);

  useEffect(() => {
    setCloudStatus(t('superadmin.emails.checking'));
  }, [t]);

  useEffect(() => {
    void refreshCloudMessages();
  }, [refreshCloudMessages]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setSessionEmail(null);
          setCloudStatus(t('superadmin.emails.notConfigured'));
        }
        return;
      }
      const email = await getCloudSessionEmail();
      if (cancelled) return;
      setSessionEmail(email);
      if (!email) {
        setCloudStatus(t('superadmin.emails.noCloudSession'));
        return;
      }
      if (!cloudAdmin) {
        setCloudStatus(
          `جلسة سحابية: ${email} — لكن حساب التطبيق محلي. اخرج تماماً ثم ادخل من /admin بنفس إيميل Sign up.`
        );
        return;
      }
      setCloudStatus(`سحابة ✓ — ${email}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, cloudAdmin]);

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured() || !currentUser || !isUuid(currentUser.id)) {
      setCloudHits([]);
      return;
    }
    const q = query.trim();
    const timer = setTimeout(() => {
      void (async () => {
        const sb = getSupabase();
        const session = sb ? (await sb.auth.getSession()).data.session : null;
        if (!session) {
          if (!cancelled) setCloudHits([]);
          return;
        }
        const hits =
          q.length >= 1
            ? await searchProfiles(q, currentUser.id)
            : await listRecentProfiles(currentUser.id);
        if (cancelled) return;
        setCloudHits(
          hits.map((h) => ({
            id: h.id,
            name: h.name,
            email: h.email,
          }))
        );
      })();
    }, q.length >= 1 ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, currentUser]);

  // عند كتابة إيميل كامل: عيّن المستلم تلقائياً حتى بدون ظهوره في البحث
  useEffect(() => {
    const email = normalizeEmail(toEmail);
    if (!email.includes('@') || email.length < 5) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void findProfileIdByEmail(email).then((hit) => {
        if (cancelled || !hit) return;
        setToId(hit.id);
        setCloudHits((prev) => {
          if (prev.some((p) => p.id === hit.id)) return prev;
          return [{ id: hit.id, name: hit.name, email: hit.email }, ...prev];
        });
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [toEmail]);

  const recipients = useMemo(() => {
    const map = new Map<string, RecipientChip>();
    for (const r of cloudHits) map.set(r.id, r);
    if (!cloudAdmin) {
      for (const u of users) {
        if (u.id === currentUser?.id || u.role === 'superadmin') continue;
        if (
          !matchesSearchQuery(
            query,
            u.name,
            u.email,
            u.handle,
            u.visibleId,
            u.mobile
          )
        ) {
          continue;
        }
        map.set(u.id, { id: u.id, name: u.name, email: u.email });
      }
    }
    return Array.from(map.values());
  }, [users, currentUser, query, cloudHits, cloudAdmin]);

  const sent = useMemo(() => {
    const fromProvider = currentUser
      ? messages.filter((m) => m.senderId === currentUser.id)
      : [];
    const merged = [...localSent, ...fromProvider];
    const seen = new Set<string>();
    return merged
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .filter((m) => {
        const recipient =
          users.find((u) => u.id === m.recipientId) ||
          cloudHits.find((u) => u.id === m.recipientId);
        return matchesSearchQuery(
          query,
          m.subject,
          m.body,
          m.id,
          recipient?.name,
          recipient?.email
        );
      });
  }, [messages, currentUser, localSent, users, query, cloudHits]);

  const onSend = useCallback(async () => {
    if (sending) return;
    let recipientId = toId;
    if (!recipientId && toEmail.trim()) {
      const hit = await findProfileIdByEmail(normalizeEmail(toEmail));
      if (!hit) {
        toast({
          variant: 'destructive',
          title: 'المستلم غير موجود',
          description: !sessionEmail
            ? 'لا توجد جلسة سحابية. اخرج وادخل من /admin بإيميل Sign up.'
            : 'لا يوجد حساب بهذا الإيميل في profiles. تأكد من إيميل المتابع في Supabase.',
        });
        return;
      }
      recipientId = hit.id;
      setToId(hit.id);
    }
    if (!recipientId) {
      toast({
        variant: 'destructive',
        title: 'اختر مستلماً',
        description: 'الصق إيميل المتابع في الحقل أدناه ثم أرسل.',
      });
      return;
    }
    setSending(true);
    try {
      const ok = await sendMessage({
        recipientId,
        subject,
        body,
      });
      if (ok && currentUser) {
        setLocalSent((prev) => [
          {
            id: `local-${Date.now()}`,
            senderId: currentUser.id,
            senderName: currentUser.name,
            senderAvatar: currentUser.avatar || '',
            recipientId,
            subject: subject.trim(),
            body: body.trim(),
            timestamp: new Date(),
            read: false,
            localSent: true,
          },
          ...prev,
        ]);
        setSubject('');
        setBody('');
        setToId('');
        setToEmail('');
      }
    } finally {
      setSending(false);
    }
  }, [
    toId,
    toEmail,
    subject,
    body,
    sendMessage,
    currentUser,
    sending,
    toast,
    sessionEmail,
  ]);

  return (
    <Screen>
      <FlatList
        data={sent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <Title>{t('nav.emails')}</Title>
            <Muted>{t('superadmin.emails.subtitle')}</Muted>
            <Card style={{ gap: 6 }}>
              <Muted>{cloudStatus}</Muted>
              {!cloudAdmin || !sessionEmail ? (
                <>
                  <Muted>
                    بدون جلسة سحابية لن يظهر متابع الأندرويد. اضغط الزر أدناه ثم
                    ادخل بإيميل Sign up (بعد ترقية SQL) — وليس الإيميل المعدّل
                    محلياً.
                  </Muted>
                  <Button
                    label="خروج الآن لإعادة الدخول السحابي"
                    variant="outline"
                    onPress={() => logout()}
                  />
                </>
              ) : (
                <Muted>
                  لا حاجة للبحث إن عرفت الإيميل: الصقه في «إيميل المستلم» مباشرة.
                </Muted>
              )}
            </Card>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث بالاسم أو جزء من الإيميل"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Card style={{ gap: 10 }}>
              <Subtitle>{t('superadmin.emails.compose')}</Subtitle>
              <Input
                label="إيميل المستلم (الصق إيميل المتابع هنا)"
                value={toEmail}
                onChangeText={setToEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                ltr
                placeholder="follower@email.com"
              />
              {toId ? (
                <Muted>تم ربط المستلم ✓</Muted>
              ) : (
                <Muted>لم يُحدَّد مستلم بعد</Muted>
              )}
              <View style={styles.recipients}>
                {recipients.map((u) => (
                  <Button
                    key={u.id}
                    label={u.email ? `${u.name} · ${u.email}` : u.name}
                    variant={toId === u.id ? 'primary' : 'outline'}
                    onPress={() => {
                      setToId(u.id);
                      if (u.email) setToEmail(u.email);
                    }}
                    style={{ flexGrow: 0 }}
                  />
                ))}
              </View>
              {!recipients.length && cloudAdmin && sessionEmail ? (
                <Muted>
                  القائمة فارغة؟ الصق إيميل المتابع كاملاً في الحقل أعلاه ثم
                  اضغط إرسال.
                </Muted>
              ) : null}
              <Input
                label={t('superadmin.emails.subject')}
                value={subject}
                onChangeText={setSubject}
              />
              <Input
                label={t('superadmin.emails.body')}
                value={body}
                onChangeText={setBody}
                multiline
              />
              <Button
                label={sending ? '...' : t('superadmin.emails.send')}
                onPress={() => void onSend()}
                disabled={sending}
              />
            </Card>

            <Subtitle>{t('superadmin.emails.sentMessages')}</Subtitle>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              query.trim()
                ? t('superadmin.noSearchResults')
                : t('superadmin.emails.emptySent')
            }
            icon="mail-outline"
          />
        }
        renderItem={({ item }) => {
          const recipient =
            users.find((u) => u.id === item.recipientId) ||
            cloudHits.find((u) => u.id === item.recipientId);
          return (
            <Card style={styles.sentCard}>
              <View style={styles.row}>
                <Avatar
                  uri={
                    users.find((u) => u.id === item.recipientId)?.avatar
                  }
                  name={recipient?.name ?? '?'}
                  size={36}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.subject, { color: theme.colors.text }]}>
                    {item.subject}
                  </Text>
                  <Muted>
                    {t('superadmin.emails.toLine', {
                      name: recipient?.name ?? item.recipientId,
                    })}
                  </Muted>
                  <Text
                    style={[styles.body, { color: theme.colors.textMuted }]}
                    numberOfLines={2}
                  >
                    {item.body}
                  </Text>
                  <Muted>{formatArabicDate(item.timestamp)}</Muted>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  recipients: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sentCard: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  subject: { fontWeight: '800', textAlign: 'left' },
  body: {
    textAlign: 'left',
    fontSize: 12,
    lineHeight: 18,
  },
});

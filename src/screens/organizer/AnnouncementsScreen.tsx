import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/providers/ToastProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useTournament } from '@/providers/TournamentProvider';
import { useNotificationsApi } from '@/providers/NotificationsProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { confirmDestructive } from '@/utils/confirm';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { formatArabicDate } from '@/utils';
import { createId } from '@/utils/id';
import { getJson, setJson } from '@/services/storage';
import { fetchAppBlob, upsertAppBlob } from '@/services/supabase-app-blobs';
import { isUuid } from '@/services/supabase-messages';
import { resolveCompetitionAlertAudience } from '@/utils/competition-alert-recipients';

type CompetitionAlert = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  organizerId: string;
  competitionId: string;
  competitionName: string;
  competitionLogo?: string;
  recipientCount: number;
  recipientIds: string[];
};

const STORAGE_PREFIX = 'seellie.organizer.announcements.v1';

export default function AnnouncementsScreen() {
  const { toast } = useToast();
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { currentUser, competitions, users, referees } = useTournament();
  const { addNotification } = useNotificationsApi();
  const [items, setItems] = useState<CompetitionAlert[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const storageKey = currentUser?.id
    ? `${STORAGE_PREFIX}.${currentUser.id}`
    : STORAGE_PREFIX;

  const myCompetitions = useMemo(
    () => competitions.filter((c) => c.organizerId === currentUser?.id),
    [competitions, currentUser?.id]
  );

  useEffect(() => {
    if (!competitionId && myCompetitions[0]?.id) {
      setCompetitionId(myCompetitions[0].id);
    }
  }, [competitionId, myCompetitions]);

  const selectedCompetition = myCompetitions.find((c) => c.id === competitionId);

  const audience = useMemo(
    () =>
      resolveCompetitionAlertAudience(
        selectedCompetition,
        users,
        referees,
        currentUser?.id
      ),
    [selectedCompetition, users, referees, currentUser?.id]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await getJson<CompetitionAlert[]>(storageKey);
      let next = Array.isArray(stored) ? stored : [];

      // تطبيع السجلات القديمة التي بلا competitionName / recipientIds
      next = next.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.createdAt,
        organizerId: row.organizerId,
        competitionId: row.competitionId || '',
        competitionName:
          row.competitionName ||
          competitions.find((c) => c.id === row.competitionId)?.name ||
          '',
        competitionLogo:
          row.competitionLogo ||
          competitions.find((c) => c.id === row.competitionId)?.logo ||
          undefined,
        recipientCount: row.recipientCount ?? row.recipientIds?.length ?? 0,
        recipientIds: Array.isArray(row.recipientIds) ? row.recipientIds : [],
      }));

      if (currentUser?.id && isUuid(currentUser.id)) {
        // مفتاح RLS المسموح: announcements:{auth.uid()} فقط
        const cloud = await fetchAppBlob<CompetitionAlert[]>(
          `announcements:${currentUser.id}`
        );
        if (Array.isArray(cloud.data) && cloud.data.length) {
          next = cloud.data.map((row) => ({
            id: row.id,
            title: row.title,
            body: row.body,
            createdAt: row.createdAt,
            organizerId: row.organizerId,
            competitionId: row.competitionId || '',
            competitionName:
              row.competitionName ||
              competitions.find((c) => c.id === row.competitionId)?.name ||
              '',
            competitionLogo:
              row.competitionLogo ||
              competitions.find((c) => c.id === row.competitionId)?.logo ||
              undefined,
            recipientCount: row.recipientCount ?? row.recipientIds?.length ?? 0,
            recipientIds: Array.isArray(row.recipientIds) ? row.recipientIds : [],
          }));
        }
      }
      if (!active) return;
      setItems(next);
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [currentUser?.id, storageKey, competitions]);

  useEffect(() => {
    if (!hydrated) return;
    void setJson(storageKey, items);
    if (currentUser?.id && isUuid(currentUser.id)) {
      void upsertAppBlob(`announcements:${currentUser.id}`, items).then(
        (res) => {
          if (!res.ok) {
            console.warn('[competition-alerts] cloud upsert failed', res.error);
            toast({
              variant: 'destructive',
              title: t('cloud.alertsSyncFailed'),
              description: res.error,
            });
          }
        }
      );
    }
  }, [items, hydrated, currentUser?.id, storageKey, toast, t]);

  const mine = items.filter((a) => a.organizerId === currentUser?.id);

  const publishAlert = async () => {
    if (!currentUser) return;
    if (!selectedCompetition) {
      toast({
        variant: 'destructive',
        title: t('toasts.t045_e1da8e'),
        description: t('organizer.announcements.pickCompetitionRequired'),
      });
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast({
        variant: 'destructive',
        title: t('toasts.t045_e1da8e'),
        description: t('organizer.announcements.fieldsRequired'),
      });
      return;
    }

    setPublishing(true);
    try {
      const alertId = createId('alert');
      const createdAt = new Date().toISOString();
      const recipientIds = audience.linkedUserIds;
      const alert: CompetitionAlert = {
        id: alertId,
        title: title.trim(),
        body: body.trim(),
        createdAt,
        organizerId: currentUser.id,
        competitionId: selectedCompetition.id,
        competitionName: selectedCompetition.name,
        competitionLogo: selectedCompetition.logo,
        recipientCount: recipientIds.length,
        recipientIds,
      };

      setItems((prev) => [alert, ...prev]);

      const notifTitle = title.trim();
      const competitionName = selectedCompetition.name;
      const competitionLogo = selectedCompetition.logo;

      for (const recipientId of recipientIds) {
        addNotification({
          id: `alert-${alertId}-${recipientId}`,
          kind: 'announcement',
          recipientId,
          competitionId: selectedCompetition.id,
          competitionName,
          competitionLogo,
          title: notifTitle,
          body: body.trim(),
          href: '/notifications',
        });
      }

      setTitle('');
      setBody('');
      toast({
        variant: 'success',
        title: t('organizer.announcements.published'),
        description: t('organizer.announcements.publishedDesc', {
          count: recipientIds.length,
        }),
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('organizer.announcements.title')}</Title>
      <Muted>{t('organizer.announcements.subtitle')}</Muted>
      <Muted>{t('organizer.announcements.scopeNote')}</Muted>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.announcements.newAnnouncement')}</Subtitle>

        <Muted>{t('organizer.announcements.chooseCompetition')}</Muted>
        {myCompetitions.length === 0 ? (
          <Muted>{t('organizer.announcements.noCompetitions')}</Muted>
        ) : (
          <View style={styles.compList}>
            {myCompetitions.map((c) => {
              const active = c.id === competitionId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCompetitionId(c.id)}
                  style={[
                    styles.compChip,
                    {
                      borderColor: active
                        ? theme.colors.accent
                        : theme.colors.border,
                      backgroundColor: active
                        ? theme.colors.accentSoft
                        : theme.colors.inputBg,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.compChipText,
                      {
                        color: active
                          ? theme.colors.accent
                          : theme.colors.text,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {selectedCompetition ? (
          <Muted>
            {t('organizer.announcements.audienceSummary', {
              managers: audience.managers,
              players: audience.players,
              referees: audience.referees,
              linked: audience.linkedUserIds.length,
            })}
          </Muted>
        ) : null}

        <Input
          label={t('organizer.announcements.titleLabel')}
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label={t('organizer.announcements.contentLabel')}
          value={body}
          onChangeText={setBody}
          multiline
        />
        <Button
          label={t('organizer.announcements.publish')}
          onPress={() => void publishAlert()}
          disabled={publishing || myCompetitions.length === 0}
        />
      </Card>

      {mine.length === 0 ? (
        <EmptyState
          title={t('organizer.announcements.empty')}
          description={t('organizer.announcements.emptyDesc')}
          icon="notifications-outline"
        />
      ) : (
        mine.map((a) => (
          <Card key={a.id} style={styles.card}>
            <View
              style={[
                styles.row,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Subtitle>{a.title}</Subtitle>
                {a.competitionName ? (
                  <Muted>
                    {t('organizer.announcements.forCompetition', {
                      name: a.competitionName,
                    })}
                  </Muted>
                ) : null}
                <Text
                  style={[
                    styles.body,
                    {
                      color: theme.colors.text,
                      textAlign: 'left',
                    },
                  ]}
                >
                  {a.body}
                </Text>
                <Muted>
                  {formatArabicDate(new Date(a.createdAt))}
                  {a.recipientCount > 0
                    ? ` · ${t('organizer.announcements.sentToCount', {
                        count: a.recipientCount,
                      })}`
                    : ''}
                </Muted>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('superadmin.actions.delete')}
                onPress={() => {
                  void (async () => {
                    const ok = await confirmDestructive({
                      title: t('organizer.announcements.deleteConfirmTitle'),
                      message: t(
                        'organizer.announcements.deleteConfirmMessage'
                      ),
                      cancelLabel: t('common.cancel'),
                      confirmLabel: t('common.delete'),
                    });
                    if (!ok) return;
                    setItems((prev) => prev.filter((x) => x.id !== a.id));
                    toast({
                      title: t('organizer.announcements.deleted'),
                      description: t('organizer.announcements.deletedDesc'),
                    });
                  })();
                }}
              >
                <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>
                  {t('superadmin.actions.delete')}
                </Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 12, paddingBottom: 40 },
  card: { gap: 10 },
  row: { gap: 10, alignItems: 'flex-start' },
  body: { lineHeight: 20 },
  compList: { gap: 8 },
  compChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compChipText: { fontSize: 14, fontWeight: '700' },
});

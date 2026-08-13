import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Button, Chip, Input, Muted, Subtitle } from '@/components/ui';
import type { ShareCardKind } from '@/data/initial-data';
import { userHasRole } from '@/utils/roles';
import { MEDIA_SPECS, PROFILE_VIDEO_MAX_SEC, validatePickerAsset } from '@/utils/media-limits';
import { persistLocalMediaUri } from '@/utils/persist-media';
import { isSupabaseConfigured } from '@/services/supabase';
import { searchProfiles } from '@/services/supabase-share';

export type ContentSharePayload = {
  kind?: ShareCardKind;
  title?: string;
  body?: string;
  mediaUrl?: string;
  mediaKind?: 'photo' | 'video' | 'text' | 'link';
  /** يُستخدم فقط لملء حقل البحث — دون عرض قائمة مستلمين */
  presetRecipientId?: string;
  presetRecipientName?: string;
  presetRecipientKind?: 'user' | 'referee';
  competitionId?: string;
  competitionName?: string;
  teamId?: string;
  teamName?: string;
  position?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  payload: ContentSharePayload | null;
};

type Hit = {
  id: string;
  name: string;
  handle: string;
  kind: 'user' | 'referee';
};

function ShareTargetModalComponent({ visible, onClose, payload }: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { toast } = useToast();
  const { currentUser, users, competitions, sendShareCard } = useTournament();

  const isJoin = payload?.kind === 'join_request';
  const [query, setQuery] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  const [competitionName, setCompetitionName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [note, setNote] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaKind, setMediaKind] = useState<'photo' | 'video' | 'text' | 'link'>(
    'text'
  );
  const [picking, setPicking] = useState(false);
  const [remoteHits, setRemoteHits] = useState<Hit[]>([]);

  useEffect(() => {
    if (!visible || !payload) return;
    setCompetitionId(payload.competitionId || '');
    setCompetitionName(payload.competitionName || '');
    setTeamId(payload.teamId || '');
    setTeamName(payload.teamName || '');
    setNote(payload.body || '');
    setMediaUrl(payload.mediaUrl || '');
    setMediaKind(payload.mediaKind || (payload.mediaUrl ? 'photo' : 'text'));
    setPicking(false);
    // مستلم مسبق من زر اللاعب — دون عرض قائمة عامة
    if (payload.presetRecipientId && payload.presetRecipientName) {
      const u = users.find((x) => x.id === payload.presetRecipientId);
      if (
        u &&
        !userHasRole(u, 'superadmin') &&
        !userHasRole(u, 'organizer')
      ) {
        setRecipientId(u.id);
        setQuery(u.handle ? `${u.name} · ${u.handle}` : u.name);
        return;
      }
      setRecipientId('');
      setQuery(payload.presetRecipientName);
      return;
    }
    setQuery('');
    setRecipientId('');
  }, [visible, payload, users]);

  const myCompetitions = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'organizer') {
      return competitions.filter((c) => c.organizerId === currentUser.id);
    }
    return competitions;
  }, [competitions, currentUser]);

  const selectedCompetition = myCompetitions.find((c) => c.id === competitionId);
  const teams = selectedCompetition?.teams || [];

  const localHits = useMemo(() => {
    if (!currentUser) return [] as Hit[];
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [] as Hit[];

    const list: Hit[] = [];
    users.forEach((u) => {
      if (u.id === currentUser.id) return;
      if (userHasRole(u, 'superadmin') || userHasRole(u, 'organizer')) return;
      const blob =
        `${u.name} ${u.handle || ''} ${u.email || ''} ${u.visibleId || ''}`.toLowerCase();
      if (!blob.includes(q)) return;
      list.push({
        id: u.id,
        name: u.name,
        handle: u.handle || u.visibleId || '',
        kind: 'user',
      });
    });
    return list.slice(0, 6);
  }, [users, currentUser, query]);

  useEffect(() => {
    let active = true;
    const q = query.trim();
    if (!isSupabaseConfigured() || !currentUser || q.length < 2) {
      setRemoteHits([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchProfiles(q, currentUser.id).then((rows) => {
        if (!active) return;
        setRemoteHits(rows);
      });
    }, 280);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, currentUser]);

  const hits = useMemo(() => {
    const map = new Map<string, Hit>();
    [...remoteHits, ...localHits].forEach((h) => {
      if (!map.has(h.id)) map.set(h.id, h);
    });
    return [...map.values()].slice(0, 8);
  }, [remoteHits, localHits]);

  const selected = useMemo(() => {
    if (!recipientId) return null;
    const fromHits = hits.find((h) => h.id === recipientId);
    if (fromHits) return fromHits;
    const u = users.find((x) => x.id === recipientId);
    if (!u) return null;
    if (userHasRole(u, 'superadmin') || userHasRole(u, 'organizer')) return null;
    return {
      id: u.id,
      name: u.name,
      handle: u.handle || u.visibleId || '',
      kind: 'user' as const,
    };
  }, [recipientId, hits, users]);

  const externalText = useMemo(() => {
    if (!payload) return '';
    if (isJoin) {
      return [
        t('shareCards.externalJoinIntro'),
        `${t('shareCards.competitionLabel')}: ${
          competitionName || selectedCompetition?.name || '—'
        }`,
        `${t('shareCards.teamLabel')}: ${
          teamName || teams.find((x) => x.id === teamId)?.name || '—'
        }`,
        note ? note : '',
        t('shareCards.externalInviteFooter'),
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      payload.title || t('shareCards.badgeContent'),
      note || payload.body || '',
      mediaUrl ? `${t('shareCards.mediaLink')}: ${mediaUrl}` : '',
      t('shareCards.externalInviteFooter'),
    ]
      .filter(Boolean)
      .join('\n');
  }, [
    payload,
    isJoin,
    competitionName,
    selectedCompetition,
    teamName,
    teams,
    teamId,
    note,
    mediaUrl,
    t,
  ]);

  const pickMedia = useCallback(
    async (type: 'photo' | 'video') => {
      try {
        setPicking(true);
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          toast({
            variant: 'destructive',
            title: t('media.permissionDenied'),
            description: t('media.allowLibrary'),
          });
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: type === 'photo' ? ['images'] : ['videos'],
          quality: 0.85,
          allowsEditing: false,
          videoMaxDuration: PROFILE_VIDEO_MAX_SEC,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const asset = result.assets[0];
        const check = validatePickerAsset(type, {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          duration: asset.duration,
        });
        if (!check.ok) {
          toast({
            variant: 'destructive',
            title:
              check.reason === 'duration'
                ? t('media.videoTooLong')
                : check.reason === 'size'
                  ? t('media.fileTooLarge')
                  : t('media.imageTooSmall'),
            description:
              check.reason === 'size'
                ? t('media.fileTooLargeDesc', {
                    mb: MEDIA_SPECS[type].maxMb,
                  })
                : undefined,
          });
          return;
        }
        setMediaUrl(await persistLocalMediaUri(asset.uri, type));
        setMediaKind(type);
      } catch {
        toast({
          variant: 'destructive',
          title: t('media.pickFailed'),
        });
      } finally {
        setPicking(false);
      }
    },
    [t, toast]
  );

  const sendInApp = async () => {
    if (!payload || !selected) {
      toast({
        variant: 'destructive',
        title: t('shareCards.needRecipientSearch'),
      });
      return;
    }
    if (!isJoin) {
      const hasContent =
        !!note.trim() ||
        !!mediaUrl.trim() ||
        !!payload.title?.trim() ||
        !!payload.body?.trim();
      if (!hasContent) {
        toast({
          variant: 'destructive',
          title: t('shareCards.needContent'),
          description: t('shareCards.pickMediaHint'),
        });
        return;
      }
    }
    const ok = await sendShareCard({
      kind: isJoin ? 'join_request' : 'content',
      recipientId: selected.id,
      recipientName: selected.name,
      recipientKind: selected.kind,
      title: payload.title,
      body: note || payload.body,
      mediaUrl: mediaUrl.trim() || undefined,
      mediaKind: mediaUrl
        ? mediaKind === 'link'
          ? 'link'
          : mediaKind === 'text'
            ? 'photo'
            : mediaKind
        : note
          ? 'text'
          : undefined,
      competitionId: competitionId || payload.competitionId,
      competitionName:
        competitionName ||
        selectedCompetition?.name ||
        payload.competitionName,
      teamId: teamId || payload.teamId,
      teamName:
        teamName ||
        teams.find((x) => x.id === teamId)?.name ||
        payload.teamName,
      position: payload.position,
    });
    if (ok) {
      onClose();
      setQuery('');
      setRecipientId('');
      setMediaUrl('');
    }
  };

  const openWhatsApp = async () => {
    try {
      // إن وُجد مرفق محلي/بعيد: ورقة المشاركة النظامية أفضل لنقل الملف
      if (mediaUrl && !/^https?:\/\//i.test(mediaUrl)) {
        await Share.share({
          message: externalText,
          url: mediaUrl,
        });
        return;
      }
      if (mediaUrl && /^https?:\/\//i.test(mediaUrl)) {
        await Share.share({
          message: `${externalText}\n${mediaUrl}`,
          url: mediaUrl,
        });
        return;
      }
      const text = encodeURIComponent(externalText);
      const appUrl = `whatsapp://send?text=${text}`;
      const webUrl = `https://wa.me/?text=${text}`;
      const can = await Linking.canOpenURL(appUrl);
      await Linking.openURL(can ? appUrl : webUrl);
    } catch {
      toast({
        variant: 'destructive',
        title: t('shareCards.whatsappFailed'),
      });
    }
  };

  const openSystemShare = async () => {
    try {
      await Share.share({
        message: externalText,
        ...(mediaUrl ? { url: mediaUrl } : {}),
      });
    } catch {
      toast({
        variant: 'destructive',
        title: t('shareCards.snapchatFailed'),
      });
    }
  };

  if (!payload) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={[
              styles.head,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <Subtitle style={{ flex: 1 }}>
              {isJoin ? t('shareCards.typeJoin') : t('shareCards.shareThis')}
            </Subtitle>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 10 }}>
            {isJoin ? (
              <>
                <Muted>{t('shareCards.joinHint')}</Muted>
                <View style={styles.chips}>
                  {myCompetitions.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      active={competitionId === c.id}
                      onPress={() => {
                        setCompetitionId(c.id);
                        setCompetitionName(c.name);
                        setTeamId('');
                        setTeamName('');
                      }}
                    />
                  ))}
                </View>
                <Input
                  label={t('shareCards.competitionLabel')}
                  value={competitionName}
                  onChangeText={setCompetitionName}
                />
                <View style={styles.chips}>
                  {teams.map((team) => (
                    <Chip
                      key={team.id}
                      label={team.name}
                      active={teamId === team.id}
                      onPress={() => {
                        setTeamId(team.id);
                        setTeamName(team.name);
                      }}
                    />
                  ))}
                </View>
                <Input
                  label={t('shareCards.teamLabel')}
                  value={teamName}
                  onChangeText={setTeamName}
                />
              </>
            ) : (
              <>
                <Muted>{t('shareCards.pickMediaHint')}</Muted>
                <View style={styles.pickRow}>
                  <Button
                    label={
                      picking
                        ? t('media.picking')
                        : t('media.pickPhotoFromDevice')
                    }
                    variant="secondary"
                    style={{ flex: 1 }}
                    loading={picking}
                    onPress={() => void pickMedia('photo')}
                  />
                  <Button
                    label={t('media.pickVideoFromDevice')}
                    variant="outline"
                    style={{ flex: 1 }}
                    disabled={picking}
                    onPress={() => void pickMedia('video')}
                  />
                </View>

                {mediaUrl ? (
                  <View
                    style={[
                      styles.preview,
                      { borderColor: theme.colors.border },
                    ]}
                  >
                    {mediaKind === 'video' ? (
                      <View
                        style={[
                          styles.videoBox,
                          { backgroundColor: theme.colors.inputBg },
                        ]}
                      >
                        <Ionicons
                          name="videocam"
                          size={28}
                          color={theme.colors.accent}
                        />
                        <Muted>{t('common.video')}</Muted>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: mediaUrl }}
                        style={styles.previewImage}
                        resizeMode="cover"
                      />
                    )}
                    <Pressable
                      onPress={() => {
                        setMediaUrl('');
                        setMediaKind('text');
                      }}
                      hitSlop={8}
                      style={styles.clearMedia}
                    >
                      <Muted>{t('shareCards.removeMedia')}</Muted>
                    </Pressable>
                  </View>
                ) : (
                  <Muted>{t('shareCards.noMediaYet')}</Muted>
                )}
              </>
            )}

            <Muted>{t('shareCards.inAppOrExternal')}</Muted>

            <Input
              label={t('shareCards.searchRecipient')}
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setRecipientId('');
              }}
              placeholder={t('shareCards.searchRecipientHint')}
              autoCapitalize="none"
            />

            {query.trim().length > 0 && query.trim().length < 2 ? (
              <Muted>{t('shareCards.typeToSearch')}</Muted>
            ) : null}

            {hits.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => {
                  setRecipientId(h.id);
                  setQuery(h.handle ? `${h.name} · ${h.handle}` : h.name);
                }}
                style={[
                  styles.hit,
                  {
                    borderColor:
                      recipientId === h.id
                        ? theme.colors.accent
                        : theme.colors.border,
                    backgroundColor: theme.colors.inputBg,
                  },
                ]}
              >
                <Text style={[styles.hitName, { color: theme.colors.text }]}>
                  {h.name}
                </Text>
                {h.handle ? <Muted>{h.handle}</Muted> : null}
              </Pressable>
            ))}

            {query.trim().length >= 2 && hits.length === 0 ? (
              <Muted>{t('shareCards.noSearchHit')}</Muted>
            ) : null}

            <Input
              label={t('shareCards.optionalNote')}
              value={note}
              onChangeText={setNote}
              multiline
            />

            <Button
              label={t('shareCards.sendInApp')}
              onPress={() => void sendInApp()}
            />

            <View style={styles.externalRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('shareCards.viaWhatsApp')}
                onPress={() => void openWhatsApp()}
                style={[
                  styles.externalBtn,
                  {
                    backgroundColor: '#128C7E',
                    borderColor: '#075E54',
                  },
                ]}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.externalLabel}>
                  {t('shareCards.viaWhatsApp')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('shareCards.viaSystemShare')}
                onPress={() => void openSystemShare()}
                style={[
                  styles.externalBtn,
                  {
                    backgroundColor: '#FFFC00',
                    borderColor: '#111',
                  },
                ]}
              >
                <Ionicons name="logo-snapchat" size={18} color="#111" />
                <Text style={[styles.externalLabel, { color: '#111' }]}>
                  {t('shareCards.viaSystemShare')}
                </Text>
              </Pressable>
            </View>

            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={onClose}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const ShareTargetModal = memo(ShareTargetModalComponent);

export const TinyShareButton = memo(function TinyShareButton({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || t('shareCards.shareThis')}
      hitSlop={12}
      onPress={onPress}
      style={styles.tinyHit}
    >
      <View
        style={[
          styles.tiny,
          {
            backgroundColor: 'rgba(13,26,38,0.72)',
            borderColor: theme.colors.accent,
          },
        ]}
      >
        <Ionicons name="share-outline" size={12} color={theme.colors.accent} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheet: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
    maxHeight: '90%',
  },
  head: {
    alignItems: 'center',
    gap: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickRow: { flexDirection: 'row', gap: 8 },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 6,
    paddingBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 160,
  },
  videoBox: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  clearMedia: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  hit: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  hitName: { fontWeight: '700', fontSize: 14 },
  externalRow: { flexDirection: 'row', gap: 8 },
  externalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  externalLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  tinyHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiny: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

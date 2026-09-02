import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTournament, type SupportLevel } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, Chip, Input, Muted, SearchBar, Subtitle, Title } from '@/components/ui';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import { createId } from '@/utils/id';
import { matchesSearchQuery } from '@/utils/search';
import { useResponsive } from '@/hooks/useResponsive';
import { confirmDestructive } from '@/utils/confirm';
import { restoreDefaultRecognitionLevels } from '@/data/recognition-certificate-levels';
import {
  certificateImageSource,
  certificateImageUri,
} from '@/theme/certificates';
import { resolvePublicMediaUrl, cloudWriteErrorMessage } from '@/services/cloud-write';
import { isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';

type Tab = 'levels' | 'beneficiaries' | 'freelancers' | 'distribution';

async function persistCertificateImage(localUri: string): Promise<string> {
  const base = FileSystem.documentDirectory;
  if (!base) return localUri;
  const dir = `${base}certificates/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const ext = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const dest = `${dir}${createId('cert')}.${ext}`;
  await FileSystem.copyAsync({ from: localUri, to: dest });
  return dest;
}

function levelPreviewSource(level: SupportLevel) {
  const url = level.imageUrl?.trim() || '';
  if (/^(file:|data:|https?:|content:|ph:|assets-library:)/i.test(url)) {
    return { uri: url };
  }
  return certificateImageSource(level.name) ?? (url ? { uri: url } : undefined);
}

export default function SupportScreen() {
  const {
    supportLevels,
    supporters,
    users,
    giftTransactions,
    updateSupportLevels,
    currentUser,
  } = useTournament();
  const theme = useAppTheme();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { desktop } = useResponsive();
  const [tab, setTab] = useState<Tab>('levels');
  const [levels, setLevels] = useState<SupportLevel[]>(supportLevels);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const tabs = useMemo(
    (): { key: Tab; label: string }[] => [
      { key: 'levels', label: t('superadmin.support.tabs.levels') },
      { key: 'beneficiaries', label: t('superadmin.support.tabs.beneficiaries') },
      { key: 'freelancers', label: t('superadmin.support.tabs.freelancers') },
      { key: 'distribution', label: t('superadmin.support.tabs.distribution') },
    ],
    [t]
  );

  useEffect(() => {
    setLevels(supportLevels);
  }, [supportLevels]);

  const freelancers = useMemo(
    () => users.filter((u) => u.role === 'freelancer'),
    [users]
  );

  const filteredLevels = useMemo(
    () =>
      levels.filter((l) =>
        matchesSearchQuery(query, l.name, l.description, l.price, l.id)
      ),
    [levels, query]
  );

  const filteredSupporters = useMemo(
    () =>
      supporters.filter((s) =>
        matchesSearchQuery(query, s.name, s.level, s.accountNumber, s.id)
      ),
    [supporters, query]
  );

  const filteredFreelancers = useMemo(
    () =>
      freelancers.filter((f) =>
        matchesSearchQuery(query, f.name, f.email, f.handle, f.visibleId, f.bio, f.mobile)
      ),
    [freelancers, query]
  );

  const filteredGifts = useMemo(
    () =>
      giftTransactions.filter((g) =>
        matchesSearchQuery(
          query,
          g.certificateType,
          g.recipientName,
          g.gifterName,
          g.amountPaid,
          g.id,
          g.competitionName
        )
      ),
    [giftTransactions, query]
  );

  const restoreDefaults = async () => {
    const ok = await confirmDestructive({
      title: t('superadmin.support.restoreDefaultsTitle'),
      message: t('superadmin.support.restoreDefaultsConfirm'),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('common.confirm'),
    });
    if (!ok) return;
    const defaults = restoreDefaultRecognitionLevels();
    setLevels(defaults);
    updateSupportLevels(defaults);
    toast({
      variant: 'success',
      title: t('superadmin.support.restoredDefaultsTitle'),
      description: t('superadmin.support.restoredDefaultsDesc'),
    });
  };

  const saveLevels = () => {
    const cleaned = levels
      .map((l) => {
        const price = Number(l.price) || 0;
        return {
          ...l,
          name: l.name.trim(),
          description: l.description.trim(),
          price,
          kind: 'certificate' as const,
          imageUrl: l.imageUrl || certificateImageUri(l.name) || '',
        };
      })
      .filter((l) => l.name.length > 0);

    if (cleaned.length === 0) {
      toast({
        variant: 'destructive',
        title: t('superadmin.support.needOneLevel'),
      });
      return;
    }

    const names = cleaned.map((l) => l.name);
    if (new Set(names).size !== names.length) {
      toast({
        variant: 'destructive',
        title: t('superadmin.support.duplicateNames'),
      });
      return;
    }

    updateSupportLevels(cleaned);
    toast({
      variant: 'success',
      title: t('superadmin.support.savedTitle'),
      description: t('superadmin.support.savedDesc'),
    });
  };

  const updateLevel = (
    id: string,
    field: keyof SupportLevel,
    value: string | number
  ) => {
    setLevels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const addLevel = () => {
    const nextIndex = levels.length + 1;
    setLevels((prev) => [
      ...prev,
      {
        id: createId('level'),
        name: t('superadmin.support.newLevelName', { n: nextIndex }),
        price: 0,
        description: '',
        imageUrl: '',
        kind: 'certificate',
      },
    ]);
  };

  const removeLevel = async (id: string) => {
    const target = levels.find((l) => l.id === id);
    const ok = await confirmDestructive({
      title: t('superadmin.support.deleteTitle'),
      message: t('superadmin.support.deleteConfirm', {
        name: target?.name || '',
      }),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('common.confirm'),
    });
    if (!ok) return;
    setLevels((prev) => prev.filter((l) => l.id !== id));
  };

  const pickImage = useCallback(
    async (id: string) => {
      try {
        setPickingId(id);
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          toast({
            variant: 'destructive',
            title: t('superadmin.support.permissionTitle'),
            description: t('superadmin.support.permissionDesc'),
          });
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: false,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        let saved = result.assets[0].uri;
        if (
          currentUser &&
          isUuid(currentUser.id) &&
          isSupabaseConfigured()
        ) {
          const resolved = await resolvePublicMediaUrl({
            uri: saved,
            kind: 'photo',
            folder: 'certificates',
            userId: currentUser.id,
            requireCloud: true,
          });
          if (!resolved.url) {
            toast({
              variant: 'destructive',
              title: t('superadmin.support.imageFailed'),
              description: cloudWriteErrorMessage(resolved.error),
            });
            return;
          }
          saved = resolved.url;
        } else {
          saved = await persistCertificateImage(saved);
        }
        updateLevel(id, 'imageUrl', saved);
        toast({
          variant: 'success',
          title: t('superadmin.support.imageUpdated'),
        });
      } catch {
        toast({
          variant: 'destructive',
          title: t('superadmin.support.imageFailed'),
        });
      } finally {
        setPickingId(null);
      }
    },
    [t, toast, currentUser]
  );

  const restoreBundledImage = (id: string, name: string) => {
    const bundled = certificateImageUri(name);
    if (!bundled) {
      toast({
        variant: 'destructive',
        title: t('superadmin.support.noBundledImage'),
      });
      return;
    }
    updateLevel(id, 'imageUrl', bundled);
  };

  const renderLevels = () => (
    <View style={{ gap: 12 }}>
      {filteredLevels.length === 0 ? (
        <EmptyState
          title={
            query.trim()
              ? t('superadmin.noSearchResults')
              : t('superadmin.support.noLevels')
          }
          icon="ribbon-outline"
        />
      ) : (
        <View style={[styles.levelsGrid, desktop && styles.levelsGridDesktop]}>
          {filteredLevels.map((level) => {
          const preview = levelPreviewSource(level);
          return (
            <Card
              key={level.id}
              style={[styles.card, desktop && styles.cardDesktop]}
            >
              <View style={styles.cardHeader}>
                <Subtitle style={{ flex: 1 }}>{level.name || '—'}</Subtitle>
                <Muted>{t('appreciation.tabCertificates')}</Muted>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('superadmin.support.deleteLevel')}
                  hitSlop={8}
                  onPress={() => removeLevel(level.id)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={theme.colors.danger}
                  />
                </Pressable>
              </View>

              <View
                style={[
                  styles.previewWrap,
                  { backgroundColor: theme.colors.surfaceElevated },
                ]}
              >
                {preview ? (
                  <Image
                    source={preview}
                    style={styles.preview}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.previewEmpty}>
                    <Ionicons
                      name="image-outline"
                      size={28}
                      color={theme.colors.textMuted}
                    />
                    <Muted>{t('superadmin.support.noImage')}</Muted>
                  </View>
                )}
              </View>

              <View style={styles.imageActions}>
                <Button
                  label={
                    pickingId === level.id
                      ? t('superadmin.support.pickingImage')
                      : t('superadmin.support.changeImage')
                  }
                  variant="secondary"
                  onPress={() => void pickImage(level.id)}
                  disabled={pickingId === level.id}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t('superadmin.support.resetImage')}
                  variant="outline"
                  onPress={() => restoreBundledImage(level.id, level.name)}
                  style={{ flex: 1 }}
                />
              </View>
              <MediaUploadSpecs
                kind="certificate"
                title={t('media.specs.certificateTitle')}
                compact
              />

              <Input
                label={t('superadmin.support.nameLabel')}
                value={level.name}
                onChangeText={(v) => updateLevel(level.id, 'name', v)}
              />
              <Input
                label={t('superadmin.support.priceLabel')}
                value={String(level.price)}
                onChangeText={(v) =>
                  updateLevel(level.id, 'price', Number(v) || 0)
                }
                keyboardType="numeric"
              />
              <Input
                label={t('superadmin.support.descriptionLabel')}
                value={level.description}
                onChangeText={(v) => updateLevel(level.id, 'description', v)}
                multiline
              />
            </Card>
          );
        })}
        </View>
      )}

      <Button
        label={t('superadmin.support.restoreDefaults')}
        variant="outline"
        onPress={() => void restoreDefaults()}
      />
      <Button
        label={t('superadmin.support.addLevel')}
        variant="secondary"
        onPress={addLevel}
      />
      <Button label={t('superadmin.support.saveLevels')} onPress={saveLevels} />
    </View>
  );

  const renderBeneficiaries = () => (
    <View style={{ gap: 8 }}>
      {filteredSupporters.length === 0 ? (
        <EmptyState
          title={
            query.trim()
              ? t('superadmin.noSearchResults')
              : t('superadmin.support.noBeneficiaries')
          }
          description={
            query.trim()
              ? undefined
              : t('superadmin.support.noBeneficiariesDesc')
          }
          icon="people-outline"
        />
      ) : (
        filteredSupporters.map((s) => (
          <Card key={s.id} style={styles.card}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {s.name}
            </Text>
            <Muted>
              {s.level} · {s.accountNumber}
            </Muted>
          </Card>
        ))
      )}
    </View>
  );

  const renderFreelancers = () => (
    <View style={{ gap: 8 }}>
      {filteredFreelancers.length === 0 ? (
        <EmptyState
          title={
            query.trim()
              ? t('superadmin.noSearchResults')
              : t('superadmin.support.noFreelancers')
          }
          icon="person-outline"
        />
      ) : (
        filteredFreelancers.map((f) => (
          <Card key={f.id} style={styles.card}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {f.name}
            </Text>
            <Muted>{f.email}</Muted>
            <Muted>{f.bio || t('superadmin.support.noBio')}</Muted>
          </Card>
        ))
      )}
    </View>
  );

  const renderDistribution = () => (
    <View style={{ gap: 8 }}>
      {filteredGifts.length === 0 ? (
        <EmptyState
          title={
            query.trim()
              ? t('superadmin.noSearchResults')
              : t('superadmin.support.noDistribution')
          }
          description={
            query.trim()
              ? undefined
              : t('superadmin.support.noDistributionDesc')
          }
          icon="gift-outline"
        />
      ) : (
        filteredGifts.map((g) => (
          <Card key={g.id} style={styles.card}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {t('superadmin.support.distributionLine', {
                type: g.certificateType,
                recipient: g.recipientName,
              })}
            </Text>
            <Muted>
              {t('superadmin.support.giftLine', {
                gifter: g.gifterName,
                amount: g.amountPaid,
              })}
            </Muted>
          </Card>
        ))
      )}
    </View>
  );

  return (
    <Screen density="dashboard">
      <FlatList
        data={[{ key: 'content' }]}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <Title>{t('superadmin.modules.support.title')}</Title>
            <Muted>{t('superadmin.support.subtitle')}</Muted>
            <View style={styles.tabs}>
              {tabs.map((tabItem) => (
                <Pressable
                  key={tabItem.key}
                  onPress={() => {
                    setTab(tabItem.key);
                    setQuery('');
                  }}
                  style={{ flexGrow: 1, flexBasis: '45%' }}
                >
                  <Chip
                    label={tabItem.label}
                    active={tab === tabItem.key}
                    onPress={() => {
                      setTab(tabItem.key);
                      setQuery('');
                    }}
                  />
                </Pressable>
              ))}
            </View>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={t('superadmin.searchPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        }
        renderItem={() => (
          <>
            {tab === 'levels' ? renderLevels() : null}
            {tab === 'beneficiaries' ? renderBeneficiaries() : null}
            {tab === 'freelancers' ? renderFreelancers() : null}
            {tab === 'distribution' ? renderDistribution() : null}
          </>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  tabs: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  levelsGrid: { gap: 12 },
  levelsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: { gap: 10 },
  cardDesktop: {
    width: '48%',
    flexGrow: 1,
    minWidth: 340,
    maxWidth: '48%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewWrap: {
    width: '100%',
    aspectRatio: 900 / 674,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', height: '100%' },
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
  imageActions: { flexDirection: 'row', gap: 8 },
  name: { fontWeight: '800', textAlign: 'left' },
});

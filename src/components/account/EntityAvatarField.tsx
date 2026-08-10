import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Avatar, Button, Input, Muted } from '@/components/ui';
import { MEDIA_SPECS, validatePickerAsset } from '@/utils/media-limits';
import {
  cloudWriteErrorMessage,
  requireCloudSession,
  resolvePublicMediaUrl,
} from '@/services/cloud-write';

type Props = {
  value?: string;
  name?: string;
  onChange: (url: string | undefined) => void;
  /** مجلد الرفع في التخزين */
  folder?: string;
  compact?: boolean;
};

/**
 * اختيار صورة لكيان (لاعب / حكم / إداري) — من الجهاز أو الكاميرا أو رابط.
 */
export function EntityAvatarField({
  value,
  name = '?',
  onChange,
  folder = 'entity-avatars',
  compact,
}: Props) {
  const { currentUser } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const resolveAndSet = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        onChange(undefined);
        return true;
      }
      setBusy(true);
      try {
        const cloud = await requireCloudSession(currentUser?.id);
        if (cloud.session) {
          const resolved = await resolvePublicMediaUrl({
            uri: trimmed,
            kind: 'photo',
            folder,
            userId: cloud.session.userId,
            requireCloud: true,
          });
          if (!resolved.url) {
            toast({
              variant: 'destructive',
              title: t('toasts.t071_355b33'),
              description: cloudWriteErrorMessage(resolved.error),
            });
            return false;
          }
          onChange(resolved.url);
          return true;
        }
        if (/^https?:\/\//i.test(trimmed)) {
          onChange(trimmed);
          return true;
        }
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
          description: cloudWriteErrorMessage(cloud.error),
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [currentUser?.id, folder, onChange, toast, t]
  );

  const validateAndApply = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      const check = validatePickerAsset('avatar', {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        duration: asset.duration,
      });
      if (!check.ok) {
        if (check.reason === 'size') {
          toast({
            variant: 'destructive',
            title: t('media.fileTooLarge'),
            description: t('media.fileTooLargeDesc', {
              mb: MEDIA_SPECS.avatar.maxMb,
            }),
          });
        } else {
          toast({
            variant: 'destructive',
            title: t('media.imageTooSmall'),
            description: t('media.imageTooSmallDesc', {
              w: MEDIA_SPECS.avatar.width,
            }),
          });
        }
        return;
      }
      await resolveAndSet(asset.uri);
    },
    [resolveAndSet, toast, t]
  );

  const pickLibrary = useCallback(async () => {
    if (busy) return;
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast({
        variant: 'destructive',
        title: t('media.permissionDenied'),
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    await validateAndApply(result.assets[0]);
  }, [busy, toast, t, validateAndApply]);

  const pickCamera = useCallback(async () => {
    if (busy) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast({
        variant: 'destructive',
        title: t('media.permissionDenied'),
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    await validateAndApply(result.assets[0]);
  }, [busy, toast, t, validateAndApply]);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Muted>{t('media.entityPhotoLabel')}</Muted>
      <View style={styles.row}>
        <Pressable
          onPress={() => void pickLibrary()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('media.pickPhotoFromDevice')}
          style={styles.avatarWrap}
        >
          <Avatar uri={value} name={name} size={compact ? 52 : 64} />
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.accent,
                borderColor: theme.colors.background,
              },
            ]}
          >
            <Ionicons
              name="camera"
              size={12}
              color={theme.colors.textInverse}
            />
          </View>
        </Pressable>
        <View style={styles.actions}>
          <Button
            label={busy ? t('media.picking') : t('media.pickPhotoFromDevice')}
            onPress={() => void pickLibrary()}
            disabled={busy}
            size="sm"
          />
          <Button
            label={t('media.takePhoto')}
            variant="secondary"
            onPress={() => void pickCamera()}
            disabled={busy}
            size="sm"
          />
        </View>
      </View>
      <Input
        label={t('media.photoUrlLabel')}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        placeholder="https://..."
        ltr
        editable={!busy}
      />
      <View style={styles.urlRow}>
        <Button
          label={t('media.addPhoto')}
          variant="outline"
          onPress={() => {
            void (async () => {
              const ok = await resolveAndSet(url);
              if (ok) setUrl('');
            })();
          }}
          disabled={busy || !url.trim()}
          size="sm"
          style={{ flex: 1 }}
        />
        {value ? (
          <Button
            label={t('media.removeAvatar')}
            variant="ghost"
            onPress={() => onChange(undefined)}
            disabled={busy}
            size="sm"
            style={{ flex: 1 }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  wrapCompact: { gap: 6 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    end: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flex: 1, gap: 6 },
  urlRow: { flexDirection: 'row', gap: 8 },
});

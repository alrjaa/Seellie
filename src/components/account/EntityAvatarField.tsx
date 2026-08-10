import React, { useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Avatar, Button, Input, Muted, Subtitle } from '@/components/ui';
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
  folder?: string;
  compact?: boolean;
};

async function pickImageAsset(
  source: 'library' | 'camera'
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'library') {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted && Platform.OS !== 'web') {
      return null;
    }
  } else {
    if (Platform.OS === 'web') {
      // الكاميرا عبر المكتبة على الويب أكثر استقراراً
      return pickImageAsset('library');
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return null;
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.85,
    // allowsEditing غالباً يكسر الالتقاط على الويب
    allowsEditing: Platform.OS !== 'web',
    aspect: [1, 1],
    exif: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

/**
 * اختيار صورة لكيان (لاعب / حكم / إداري).
 * يعرض المعاينة فوراً ثم يرفع للسحابة إن أمكن.
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
    async (raw: string, opts?: { optimistic?: boolean }) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        onChange(undefined);
        return true;
      }

      // معاينة فورية حتى لو فشل الرفع لاحقاً
      if (opts?.optimistic !== false) {
        onChange(trimmed);
      }

      setBusy(true);
      try {
        if (/^https?:\/\//i.test(trimmed)) {
          onChange(trimmed);
          return true;
        }

        const cloud = await requireCloudSession(currentUser?.id);
        if (!cloud.session) {
          // محلياً نحتفظ بالـ URI حتى لا يبدو الزر معطلاً
          toast({
            variant: 'default',
            title: t('media.localPhotoKept'),
            description: cloudWriteErrorMessage(cloud.error),
          });
          return true;
        }

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
            title: t('media.uploadFailedKeepLocal'),
            description: cloudWriteErrorMessage(resolved.error),
          });
          return true;
        }
        onChange(resolved.url);
        toast({
          variant: 'success',
          title: t('media.entityPhotoUpdated'),
        });
        return true;
      } catch (e) {
        console.warn('[EntityAvatarField]', e);
        toast({
          variant: 'destructive',
          title: t('media.pickFailed'),
          description: t('media.pickFailedHint'),
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
      if (!check.ok && check.reason === 'size') {
        toast({
          variant: 'destructive',
          title: t('media.fileTooLarge'),
          description: t('media.fileTooLargeDesc', {
            mb: MEDIA_SPECS.avatar.maxMb,
          }),
        });
        return;
      }
      // أبعاد الأفاتار: لا نرفض بعد القصّ/الويب
      await resolveAndSet(asset.uri, { optimistic: true });
    },
    [resolveAndSet, toast, t]
  );

  const pickLibrary = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const asset = await pickImageAsset('library');
      if (!asset) {
        // إلغاء المستخدم أو رفض الصلاحية
        if (Platform.OS !== 'web') {
          const perm =
            await ImagePicker.getMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            toast({
              variant: 'destructive',
              title: t('media.permissionDenied'),
            });
          }
        }
        return;
      }
      setBusy(false);
      await validateAndApply(asset);
    } catch (e) {
      console.warn('[EntityAvatarField] pick', e);
      toast({
        variant: 'destructive',
        title: t('media.pickFailed'),
        description: t('media.pickFailedHint'),
      });
    } finally {
      setBusy(false);
    }
  }, [busy, toast, t, validateAndApply]);

  const pickCamera = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const asset = await pickImageAsset('camera');
      if (!asset) {
        if (Platform.OS !== 'web') {
          const perm = await ImagePicker.getCameraPermissionsAsync();
          if (!perm.granted) {
            toast({
              variant: 'destructive',
              title: t('media.permissionDenied'),
            });
          }
        }
        return;
      }
      setBusy(false);
      await validateAndApply(asset);
    } catch (e) {
      console.warn('[EntityAvatarField] camera', e);
      toast({
        variant: 'destructive',
        title: t('media.pickFailed'),
        description: t('media.pickFailedHint'),
      });
    } finally {
      setBusy(false);
    }
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
          hitSlop={8}
        >
          <Avatar uri={value} name={name} size={compact ? 56 : 72} />
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
              size={14}
              color={theme.colors.textInverse}
            />
          </View>
        </Pressable>
        <View style={styles.actions}>
          <Button
            label={
              busy ? t('media.picking') : t('media.pickPhotoFromDevice')
            }
            onPress={() => void pickLibrary()}
            disabled={busy}
            loading={busy}
            size="sm"
          />
          {Platform.OS !== 'web' ? (
            <Button
              label={t('media.takePhoto')}
              variant="secondary"
              onPress={() => void pickCamera()}
              disabled={busy}
              size="sm"
            />
          ) : null}
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
              const ok = await resolveAndSet(url, { optimistic: true });
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

type EditModalProps = {
  visible: boolean;
  title: string;
  value?: string;
  name: string;
  folder?: string;
  onChange: (url: string | undefined) => void;
  onClose: () => void;
};

/** نافذة تعديل صورة كيان — تظهر فوراً فوق الشاشة */
export function EntityAvatarEditModal({
  visible,
  title,
  value,
  name,
  folder,
  onChange,
  onClose,
}: EditModalProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              marginTop: insets.top + 24,
              marginBottom: insets.bottom + 24,
            },
          ]}
        >
          <View style={styles.modalHead}>
            <Subtitle style={{ flex: 1 }}>{title}</Subtitle>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </Pressable>
          </View>
          <EntityAvatarField
            value={value}
            name={name}
            folder={folder}
            onChange={onChange}
          />
          <Button
            label={t('common.done')}
            variant="outline"
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
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
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flex: 1, gap: 6 },
  urlRow: { flexDirection: 'row', gap: 8 },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    zIndex: 2,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

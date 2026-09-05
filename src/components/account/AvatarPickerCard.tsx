import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Avatar, Button, Card, Input, Muted, Subtitle } from '@/components/ui';
import { MEDIA_SPECS, validatePickerAsset } from '@/utils/media-limits';

/**
 * تغيير صورة المعرّف / أيقونة الحساب (منظّم · متابع · مواهب).
 * تظهر في الهيدر والقائمة والملف الشخصي.
 */
export function AvatarPickerCard() {
  const { currentUser, setUserAvatar } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = useCallback(
    async (next: string) => {
      const trimmed = next.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      try {
        const ok = await setUserAvatar(trimmed, t('freelancer.avatarSet'));
        if (ok) setUrl('');
      } finally {
        setBusy(false);
      }
    },
    [busy, setUserAvatar, t]
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
      await apply(asset.uri);
    },
    [apply, toast, t]
  );

  const pickFromLibrary = useCallback(async () => {
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
      allowsEditing: Platform.OS !== 'web',
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    await validateAndApply(result.assets[0]);
  }, [busy, toast, t, validateAndApply]);

  const pickFromCamera = useCallback(async () => {
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
      allowsEditing: Platform.OS !== 'web',
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    await validateAndApply(result.assets[0]);
  }, [busy, toast, t, validateAndApply]);

  const clearAvatar = useCallback(async () => {
    if (!currentUser?.avatar || busy) return;
    setBusy(true);
    try {
      await setUserAvatar('', t('media.avatarRemoved'));
    } finally {
      setBusy(false);
    }
  }, [busy, currentUser?.avatar, setUserAvatar, t]);

  if (!currentUser) return null;

  return (
    <Card style={styles.card}>
      <Subtitle>{t('media.changeHandleIcon')}</Subtitle>
      <Muted>{t('media.handleIconHint')}</Muted>
      <Muted>
        {t('settings.handle')}: {currentUser.handle}
      </Muted>
      <View style={styles.row}>
        <Pressable
          onPress={() => void pickFromLibrary()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('media.pickPhotoFromDevice')}
          style={styles.avatarWrap}
        >
          <Avatar
            uri={currentUser.avatar}
            name={currentUser.name}
            size={80}
          />
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
            onPress={() => void pickFromLibrary()}
            disabled={busy}
          />
          <Button
            label={t('media.takePhoto')}
            variant="secondary"
            onPress={() => void pickFromCamera()}
            disabled={busy}
          />
          <Input
            label={t('media.photoUrlLabel')}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            placeholder="https://..."
            ltr
            editable={!busy}
          />
          <Button
            label={t('media.addPhoto')}
            variant="outline"
            onPress={() => void apply(url)}
            disabled={busy || !url.trim()}
          />
          {currentUser.avatar ? (
            <Button
              label={t('media.removeAvatar')}
              variant="ghost"
              onPress={() => void clearAvatar()}
              disabled={busy}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    end: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flex: 1, gap: 8 },
});

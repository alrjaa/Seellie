import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Avatar, Button, Card, Input, Muted, Subtitle } from '@/components/ui';
import { MEDIA_SPECS, validatePickerAsset } from '@/utils/media-limits';

/**
 * تغيير الصورة الشخصية / أيقونة الحساب (تظهر في الهيدر والقائمة).
 */
export function AvatarPickerCard() {
  const { currentUser, setUserAvatar } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [picking, setPicking] = useState(false);

  const apply = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (!trimmed) return;
      setUserAvatar(trimmed, t('freelancer.avatarSet'));
      setUrl('');
    },
    [setUserAvatar, t]
  );

  const pickFromDevice = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    try {
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
      const asset = result.assets[0];
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
      apply(asset.uri);
    } finally {
      setPicking(false);
    }
  }, [picking, toast, t, apply]);

  if (!currentUser) return null;

  return (
    <Card style={styles.card}>
      <Subtitle>{t('media.specs.avatarTitle')}</Subtitle>
      <Muted>
        تظهر كأيقونة الحساب في الهيدر بعد تحويل مسار الحساب أو أثناءه.
      </Muted>
      <View style={styles.row}>
        <Pressable
          onPress={() => void pickFromDevice()}
          accessibilityRole="button"
          accessibilityLabel={t('media.pickPhotoFromDevice')}
          style={styles.avatarWrap}
        >
          <Avatar
            uri={currentUser.avatar}
            name={currentUser.name}
            size={72}
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
              picking ? t('media.picking') : t('media.pickPhotoFromDevice')
            }
            onPress={() => void pickFromDevice()}
            disabled={picking}
          />
          <Input
            label={t('media.photoUrlLabel')}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            placeholder="https://..."
            ltr
          />
          <Button
            label={t('media.addPhoto')}
            variant="outline"
            onPress={() => apply(url)}
            disabled={!url.trim()}
          />
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

import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTournament } from '@/providers/TournamentProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import {
  ANALYSIS_VIDEO_MAX_SEC,
  isVideoWithinLimit,
  videoDurationSecFromPicker,
} from '@/utils/media-limits';

export default function CreateAnalysisScreen() {
  const { addAnalysis } = useTournament();
  const { toast } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [picking, setPicking] = useState(false);

  const pickVideo = useCallback(async () => {
    try {
      setPicking(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast({
          variant: 'destructive',
          title: t('media.permissionRequired'),
          description: t('media.allowLibraryForVideo'),
        });
        return;
      }
      const maxSec = ANALYSIS_VIDEO_MAX_SEC;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.85,
        videoMaxDuration: maxSec,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const asset = result.assets[0];
      const durationSec = videoDurationSecFromPicker(asset.duration);
      if (!isVideoWithinLimit(durationSec, maxSec)) {
        toast({
          variant: 'destructive',
          title: t('media.videoTooLong'),
          description: t('media.videoTooLongDesc', { sec: maxSec }),
        });
        return;
      }
      setVideoUrl(asset.uri);
    } catch {
      toast({
        variant: 'destructive',
        title: t('media.pickVideoFailed'),
      });
    } finally {
      setPicking(false);
    }
  }, [toast, t]);

  const submit = () => {
    const ok = addAnalysis({
      title,
      content,
      videoUrl: videoUrl.trim() || undefined,
    });
    if (ok) {
      setTitle('');
      setContent('');
      setVideoUrl('');
      router.back();
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('home.createAnalysis')}</Title>
      <Muted>{t('create.analysisSubtitle')}</Muted>

      <Card style={styles.card}>
        <Subtitle>{t('create.analysisContent')}</Subtitle>
        <Input
          label={t('create.titleLabel')}
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label={t('create.textContent')}
          value={content}
          onChangeText={setContent}
          multiline
          style={{ minHeight: 120, maxHeight: 200 }}
        />
        <Input
          label={t('create.videoUrlOptional')}
          value={videoUrl}
          onChangeText={setVideoUrl}
          autoCapitalize="none"
          ltr
        />
        <MediaUploadSpecs
          kind="analysisVideo"
          title={t('media.specs.videoTitle')}
        />
        <Button
          label={
            picking
              ? t('media.picking')
              : t('media.pickVideoFromDevice')
          }
          variant="secondary"
          loading={picking}
          onPress={() => void pickVideo()}
        />
        <Button
          label={t('create.publishAnalysis')}
          onPress={submit}
          disabled={!title.trim() || (!content.trim() && !videoUrl.trim())}
        />
        <Button
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 10 },
});

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { AppText, Muted, Subtitle } from '@/components/ui/Text';
import {
  MEDIA_SPECS,
  type MediaUploadKind,
} from '@/utils/media-limits';

type Props = {
  kind: MediaUploadKind;
  /** عنوان اختياري فوق المواصفات */
  title?: string;
  compact?: boolean;
};

/**
 * بطاقة مواصفات واضحة تُعرض بجانب أزرار رفع الصور/الفيديو/الأيقونات.
 */
function MediaUploadSpecsComponent({ kind, title, compact }: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const spec = MEDIA_SPECS[kind];
  const align = isRTL ? 'right' : 'left';

  const rows: { icon: keyof typeof Ionicons.glyphMap; text: string }[] =
    spec.kind === 'image'
      ? [
          {
            icon: 'resize-outline',
            text: t('media.specs.sizePx', {
              w: spec.width,
              h: spec.height,
            }),
          },
          {
            icon: 'crop-outline',
            text: t('media.specs.aspect', { ratio: spec.aspectLabel }),
          },
          {
            icon: 'cloud-upload-outline',
            text: t('media.specs.maxFile', { mb: spec.maxMb }),
          },
          {
            icon: 'document-outline',
            text: t('media.specs.formats', { formats: spec.formats }),
          },
        ]
      : [
          ...(spec.minDurationSec
            ? [
                {
                  icon: 'flash-outline' as const,
                  text: t('media.specs.minDuration', {
                    sec: spec.minDurationSec,
                  }),
                },
              ]
            : []),
          {
            icon: 'timer-outline',
            text: t('media.specs.maxDuration', {
              sec: spec.maxDurationSec,
            }),
          },
          {
            icon: 'resize-outline',
            text: t('media.specs.resolution', {
              w: spec.width,
              h: spec.height,
            }),
          },
          {
            icon: 'cloud-upload-outline',
            text: t('media.specs.maxFile', { mb: spec.maxMb }),
          },
          {
            icon: 'document-outline',
            text: t('media.specs.formats', { formats: spec.formats }),
          },
        ];

  return (
    <View
      style={[
        styles.box,
        compact && styles.compact,
        {
          backgroundColor: theme.isDark
            ? 'rgba(37,244,238,0.08)'
            : 'rgba(13,26,38,0.05)',
          borderColor: theme.colors.accent,
        },
      ]}
      accessibilityRole="summary"
    >
      <View
        style={[
          styles.head,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Ionicons
          name={spec.kind === 'video' ? 'videocam-outline' : 'image-outline'}
          size={18}
          color={theme.colors.accent}
        />
        <Subtitle style={{ flex: 1, textAlign: align }}>
          {title ?? t('media.specs.title')}
        </Subtitle>
      </View>
      <Muted style={{ textAlign: align, marginBottom: 4 }}>
        {t('media.specs.requiredHint')}
      </Muted>
      {rows.map((row) => (
        <View
          key={row.text}
          style={[
            styles.row,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <Ionicons
            name={row.icon}
            size={15}
            color={theme.colors.textMuted}
          />
          <AppText style={[styles.line, { textAlign: align, flex: 1 }]}>
            {row.text}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export const MediaUploadSpecs = memo(MediaUploadSpecsComponent);

const styles = StyleSheet.create({
  box: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  compact: {
    padding: 10,
    gap: 4,
  },
  head: {
    alignItems: 'center',
    gap: 8,
  },
  row: {
    alignItems: 'center',
    gap: 8,
  },
  line: {
    fontSize: 13,
    lineHeight: 20,
  },
});

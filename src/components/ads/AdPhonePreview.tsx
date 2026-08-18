import React, { memo, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { cairoText } from '@/theme/fonts';

type Props = {
  videoUri?: string;
  posterUri?: string;
  advertiserName: string;
  hookText?: string;
  title?: string;
  ctaLabel?: string;
  muted?: boolean;
  trimStart?: number;
  trimEnd?: number;
  showSafeZone?: boolean;
  isRTL?: boolean;
};

function AdPhonePreviewComponent({
  videoUri,
  posterUri,
  advertiserName,
  hookText,
  title,
  ctaLabel,
  muted = true,
  trimStart = 0,
  trimEnd,
  showSafeZone = true,
  isRTL = true,
}: Props) {
  const theme = useAppTheme();
  const videoRef = useRef<Video>(null);
  const htmlRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !htmlRef.current) return;
    const el = htmlRef.current;
    const onTime = () => {
      if (trimEnd != null && el.currentTime >= trimEnd) {
        el.currentTime = trimStart;
        void el.play().catch(() => undefined);
      }
    };
    el.addEventListener('timeupdate', onTime);
    if (Number.isFinite(trimStart) && trimStart > 0) {
      el.currentTime = trimStart;
    }
    return () => el.removeEventListener('timeupdate', onTime);
  }, [trimEnd, trimStart, videoUri]);

  return (
    <View
      style={[
        styles.device,
        {
          borderColor: theme.colors.border,
          backgroundColor: '#000',
        },
      ]}
      accessibilityLabel="معاينة الإعلان على الهاتف"
    >
      <View style={styles.notch} />
      <View style={styles.screen}>
        {videoUri ? (
          Platform.OS === 'web' ? (
            React.createElement('video', {
              ref: htmlRef,
              src: videoUri,
              poster: posterUri || undefined,
              muted,
              autoPlay: true,
              loop: true,
              playsInline: true,
              style: {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                background: '#000',
              },
            })
          ) : (
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              posterSource={posterUri ? { uri: posterUri } : undefined}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted={muted}
            />
          )
        ) : (
          <View style={styles.empty}>
            <Ionicons name="videocam-outline" size={36} color="#8aa0b0" />
          </View>
        )}

        {showSafeZone ? (
          <>
            <View style={[styles.safeTop, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
              <View style={styles.closeBtn}>
                <Text style={styles.closeX}>×</Text>
              </View>
            </View>
            <View style={[styles.sponsored, { left: isRTL ? undefined : 10, right: isRTL ? 10 : undefined }]}>
              <Text style={[styles.sponsoredText, cairoText('semiBold')]}>إعلان</Text>
            </View>
            {hookText?.trim() ? (
              <View style={[styles.hook, { left: 10, right: 72 }]}>
                <Text
                  style={[
                    styles.hookText,
                    cairoText('extraBold'),
                    { textAlign: isRTL ? 'right' : 'left' },
                  ]}
                  numberOfLines={2}
                >
                  {hookText.trim()}
                </Text>
              </View>
            ) : null}
            <View style={styles.rightRail}>
              <View style={styles.railDot} />
              <View style={styles.railDot} />
              <View style={styles.ctaChip}>
                <Text style={[styles.ctaChipText, cairoText('semiBold')]} numberOfLines={1}>
                  {ctaLabel?.trim() || 'افتح'}
                </Text>
              </View>
            </View>
            <View style={styles.bottomCopy}>
              <Text style={[styles.name, cairoText('semiBold')]} numberOfLines={1}>
                {advertiserName || 'اسم المعلن'}
              </Text>
              {title?.trim() ? (
                <Text style={[styles.caption, cairoText('regular')]} numberOfLines={2}>
                  {title.trim()}
                </Text>
              ) : null}
            </View>
            <View style={styles.tabBar}>
              <View style={styles.tabPill} />
              <View style={styles.tabPill} />
              <View style={styles.tabPill} />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

export const AdPhonePreview = memo(AdPhonePreviewComponent);

const styles = StyleSheet.create({
  device: {
    width: 280,
    height: 560,
    borderRadius: 36,
    borderWidth: 10,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  notch: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    width: 88,
    height: 18,
    borderRadius: 10,
    backgroundColor: '#111',
    zIndex: 4,
  },
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeTop: {
    position: 'absolute',
    top: 28,
    left: 10,
    right: 10,
    zIndex: 3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { color: '#fff', fontSize: 18, lineHeight: 20 },
  sponsored: {
    position: 'absolute',
    top: 32,
    zIndex: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sponsoredText: { color: '#fff', fontSize: 10 },
  hook: {
    position: 'absolute',
    top: 62,
    zIndex: 3,
  },
  hookText: { color: '#fff', fontSize: 13, textShadowColor: '#000', textShadowRadius: 6 },
  rightRail: {
    position: 'absolute',
    right: 10,
    bottom: 88,
    zIndex: 3,
    alignItems: 'center',
    gap: 10,
  },
  railDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ctaChip: {
    maxWidth: 72,
    backgroundColor: '#25F4EE',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  ctaChipText: { color: '#0d1a26', fontSize: 9, textAlign: 'center' },
  bottomCopy: {
    position: 'absolute',
    left: 12,
    right: 84,
    bottom: 52,
    zIndex: 3,
    gap: 4,
  },
  name: { color: '#fff', fontSize: 13 },
  caption: { color: 'rgba(255,255,255,0.88)', fontSize: 12 },
  tabBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 12,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    zIndex: 3,
  },
  tabPill: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});

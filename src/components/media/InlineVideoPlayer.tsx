import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import type { Video as VideoType } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useResponsive } from '@/hooks/useResponsive';
import { clamp } from '@/theme/tokens';

type Props = {
  uri: string;
  /** ارتفاع ثابت اختياري — بدونها يُحسب حسب الشاشة (مناسب للكمبيوتر) */
  height?: number;
  style?: ViewStyle;
  /** تشغيل صامت تلقائي (اختياري) */
  autoPlayMuted?: boolean;
};

/**
 * لقطة فيديو قابلة للتشغيل داخل البطاقة (ويب + جوال)
 * يتوقف تلقائياً عند مغادرة الشاشة أو خلفية التطبيق.
 */
function InlineVideoPlayerComponent({
  uri,
  height: heightProp,
  style,
  autoPlayMuted = false,
}: Props) {
  const theme = useAppTheme();
  const focused = useIsFocused();
  const { width, height: winH, tablet } = useResponsive();
  const [fullscreen, setFullscreen] = useState(false);
  const videoRef = useRef<VideoType | null>(null);
  const fullRef = useRef<VideoType | null>(null);

  const playerHeight = useMemo(() => {
    if (typeof heightProp === 'number') return heightProp;

    const gutter = tablet ? 56 : 32;
    const cardW = Math.min(
      width - gutter,
      width >= 1024 ? 760 : width >= 768 ? 600 : width - gutter
    );
    const byRatio = Math.round(cardW * (9 / 16));

    if (Platform.OS === 'web' || tablet) {
      return clamp(
        Math.max(byRatio, Math.round(winH * 0.48)),
        380,
        Math.min(Math.round(winH * 0.68), 720)
      );
    }

    return clamp(byRatio, 200, 320);
  }, [heightProp, width, winH, tablet]);

  const stopAll = () => {
    void videoRef.current?.pauseAsync().catch(() => undefined);
    void fullRef.current?.pauseAsync().catch(() => undefined);
    if (Platform.OS === 'web') {
      void videoRef.current?.unloadAsync().catch(() => undefined);
      void fullRef.current?.unloadAsync().catch(() => undefined);
    }
    setFullscreen(false);
  };

  useEffect(() => {
    if (!focused) stopAll();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, uri]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopAll();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!uri) return null;

  const canAutoPlay = autoPlayMuted && focused;

  const videoProps = {
    source: { uri },
    useNativeControls: true,
    resizeMode: ResizeMode.CONTAIN,
    isLooping: false,
    shouldPlay: canAutoPlay,
    isMuted: autoPlayMuted,
    ...(Platform.OS === 'web' ? ({ playsInline: true } as object) : null),
  };

  return (
    <>
      <View
        style={[
          styles.wrap,
          {
            height: playerHeight,
            backgroundColor: theme.colors.surfaceElevated,
            borderColor: theme.colors.border,
          },
          style,
        ]}
      >
        {focused ? (
          <Video ref={videoRef} {...videoProps} style={styles.video} />
        ) : (
          <View style={[styles.video, { backgroundColor: '#000' }]} />
        )}

        {(Platform.OS === 'web' || tablet) && focused ? (
          <Pressable
            onPress={() => setFullscreen(true)}
            accessibilityRole="button"
            accessibilityLabel="تكبير الفيديو"
            style={[
              styles.expandBtn,
              { backgroundColor: 'rgba(0,0,0,0.55)' },
            ]}
          >
            <Ionicons name="expand-outline" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={fullscreen && focused}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={styles.fullRoot}>
          <Video
            ref={fullRef}
            {...videoProps}
            style={styles.fullVideo}
            shouldPlay
            isMuted={false}
          />
          <Pressable
            onPress={() => setFullscreen(false)}
            accessibilityRole="button"
            accessibilityLabel="إغلاق"
            style={[styles.closeBtn, { top: Platform.OS === 'web' ? 20 : 48 }]}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

export const InlineVideoPlayer = memo(InlineVideoPlayerComponent);

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  expandBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRoot: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullVideo: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});

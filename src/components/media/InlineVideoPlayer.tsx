import React, {
  createElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import type { Video as VideoType } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useResponsive } from '@/hooks/useResponsive';
import { useTranslation } from '@/providers/LanguageProvider';
import { clamp } from '@/theme/tokens';
import {
  attachSoundToPlayingVideo,
  isWebMediaSoundUnlocked,
  registerActiveWebVideo,
  startVisibleWebVideo,
  subscribeWebMediaSound,
  unregisterActiveWebVideo,
} from '@/services/web-media-sound';

type Props = {
  uri: string;
  /** ارتفاع ثابت اختياري — بدونها يُحسب حسب الشاشة (مناسب للكمبيوتر) */
  height?: number;
  style?: ViewStyle;
  /**
   * تشغيل صامت تلقائي عند ظهور الفيديو في الشاشة.
   * الافتراضي true على الويب؛ يتوقف عند التمرير بعيدًا.
   */
  autoPlayMuted?: boolean;
};

/**
 * لقطة فيديو داخل البطاقة (ويب + جوال).
 * على الويب: يعمل عند الظهور ويتوقف عند التخطي.
 */
function InlineVideoPlayerComponent({
  uri,
  height: heightProp,
  style,
  autoPlayMuted = Platform.OS === 'web',
}: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { width, height: winH, tablet } = useResponsive();
  const [fullscreen, setFullscreen] = useState(false);
  const [inView, setInView] = useState(Platform.OS !== 'web');
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const videoRef = useRef<VideoType | null>(null);
  const fullRef = useRef<VideoType | null>(null);
  const htmlRef = useRef<HTMLVideoElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

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

  const stopInline = useCallback(() => {
    void videoRef.current?.pauseAsync().catch(() => undefined);
    htmlRef.current?.pause();
  }, []);

  const stopAll = useCallback(() => {
    stopInline();
    void fullRef.current?.pauseAsync().catch(() => undefined);
    // FIX-04 P1: release native decoder resources on stop/unmount (not web-only)
    void videoRef.current?.unloadAsync().catch(() => undefined);
    void fullRef.current?.unloadAsync().catch(() => undefined);
    setFullscreen(false);
  }, [stopInline]);

  const markPlaybackFailed = useCallback(() => {
    setPlaybackFailed(true);
    htmlRef.current?.pause();
    void videoRef.current?.pauseAsync().catch(() => undefined);
    void fullRef.current?.pauseAsync().catch(() => undefined);
    setFullscreen(false);
  }, []);

  const bindWebVideo = useCallback(
    (node: HTMLVideoElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      htmlRef.current = node;
      if (!node) return;

      node.onerror = () => markPlaybackFailed();
      node.playsInline = true;
      node.loop = true;
      node.muted = true;
      node.defaultMuted = true;
      registerActiveWebVideo(node);
      void startVisibleWebVideo(node).then(() => {
        if (isWebMediaSoundUnlocked()) attachSoundToPlayingVideo(node);
      });

      if (!autoPlayMuted || typeof IntersectionObserver === 'undefined') {
        setInView(true);
        return;
      }

      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const visible =
            !!entry?.isIntersecting && (entry.intersectionRatio ?? 0) >= 0.3;
          setInView(visible);
          const el = htmlRef.current;
          if (!el) return;
          if (visible && focused && !fullscreen) {
            registerActiveWebVideo(el);
            void startVisibleWebVideo(el).then(() => {
              if (isWebMediaSoundUnlocked()) attachSoundToPlayingVideo(el);
            });
          } else {
            el.pause();
            unregisterActiveWebVideo(el);
          }
        },
        { threshold: [0, 0.3, 0.6, 1] }
      );
      io.observe(node);
      observerRef.current = io;
    },
    [autoPlayMuted, focused, fullscreen, markPlaybackFailed]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const attach = () => {
      const el = htmlRef.current;
      if (el) attachSoundToPlayingVideo(el);
    };
    if (isWebMediaSoundUnlocked()) attach();
    return subscribeWebMediaSound(attach);
  }, []);

  useEffect(() => {
    setPlaybackFailed(false);
  }, [uri]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      htmlRef.current?.pause();
    };
  }, [uri]);

  useEffect(() => {
    if (!focused) {
      stopAll();
      return;
    }
    return () => stopAll();
  }, [focused, uri, stopAll]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopAll();
    });
    return () => sub.remove();
  }, [stopAll]);

  const shouldAutoPlay =
    autoPlayMuted && focused && inView && !fullscreen && !playbackFailed;

  useEffect(() => {
    if (playbackFailed) return;
    if (Platform.OS === 'web') {
      const el = htmlRef.current;
      if (!el) return;
      el.muted = true;
      if (shouldAutoPlay) {
        void startVisibleWebVideo(el).then(() => {
          if (isWebMediaSoundUnlocked()) attachSoundToPlayingVideo(el);
        });
      } else el.pause();
      return;
    }
    if (!autoPlayMuted) return;
    if (shouldAutoPlay) {
      void videoRef.current?.playAsync().catch(() => undefined);
    } else {
      stopInline();
    }
  }, [shouldAutoPlay, autoPlayMuted, stopInline, uri, playbackFailed]);

  if (!uri) return null;

  if (playbackFailed) {
    return (
      <View
        accessibilityRole="alert"
        style={[
          styles.wrap,
          styles.failedWrap,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
          style,
        ]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={28}
          color={theme.colors.textMuted}
        />
        <Text
          style={[
            styles.failedTitle,
            { color: theme.colors.text },
          ]}
        >
          {t('media.videoPlayFailed')}
        </Text>
        <Text
          style={[
            styles.failedHint,
            { color: theme.colors.textMuted },
          ]}
        >
          {t('media.mediaUnavailable')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View
        collapsable={false}
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
        {focused && Platform.OS === 'web' ? (
          createElement('video', {
            key: uri,
            ref: bindWebVideo,
            src: uri,
            muted: true,
            defaultMuted: true,
            autoPlay: true,
            loop: true,
            playsInline: true,
            preload: 'auto',
            controls: !autoPlayMuted,
            onError: markPlaybackFailed,
            style: {
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              backgroundColor: '#000',
              display: 'block',
            },
          })
        ) : focused ? (
          <Video
            ref={videoRef}
            source={{ uri }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls={!autoPlayMuted}
            isLooping={autoPlayMuted}
            shouldPlay={shouldAutoPlay}
            isMuted={autoPlayMuted}
            onError={markPlaybackFailed}
          />
        ) : (
          <View
            style={[
              styles.video,
              { backgroundColor: theme.colors.surfaceElevated },
            ]}
          />
        )}

        {(Platform.OS === 'web' || tablet) && focused ? (
          <Pressable
            onPress={() => setFullscreen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('common.expandVideo')}
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
        visible={fullscreen && focused && !playbackFailed}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setFullscreen(false)}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        {Platform.OS !== 'web' ? (
          <StatusBar barStyle="light-content" backgroundColor="#000" />
        ) : null}
        <View style={styles.fullRoot}>
          <Video
            ref={fullRef}
            source={{ uri }}
            style={styles.fullVideo}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            isMuted={false}
            isLooping={false}
            onError={markPlaybackFailed}
            {...(Platform.OS === 'web'
              ? ({ playsInline: true } as object)
              : null)}
          />
          <Pressable
            onPress={() => setFullscreen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={[
              styles.closeBtn,
              { top: Math.max(insets.top, 12) + 8 },
            ]}
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
  failedWrap: {
    minHeight: 96,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  failedTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  failedHint: {
    fontSize: 13,
    textAlign: 'center',
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

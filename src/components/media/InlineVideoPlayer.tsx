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
import { useInlineVideoVisibility } from '@/hooks/useInlineVideoVisibility';
import { useNativeFeedVideoAutoplay } from '@/hooks/useNativeFeedVideoAutoplay';
import { clamp } from '@/theme/tokens';
import {
  isWebMediaSoundUnlocked,
  promoteWebVideoSound,
  registerActiveWebVideo,
  startVisibleWebVideo,
  subscribeWebMediaSound,
  unregisterActiveWebVideo,
} from '@/services/web-media-sound';
import { isRealMediaFailure } from '@/services/media-autoplay-engine';
import {
  INLINE_VISIBILITY_PLAY_RATIO,
  INLINE_VISIBILITY_STOP_RATIO,
  nextInlineVisibilityAutoplay,
  shouldMarkNativePlaybackFailed,
} from '@/services/native-feed-autoplay-policy';

type Props = {
  uri: string;
  /** ارتفاع ثابت اختياري — بدونها يُحسب حسب الشاشة (مناسب للكمبيوتر) */
  height?: number;
  style?: ViewStyle;
  /**
   * تشغيل تلقائي عند ظهور الفيديو في الشاشة.
   * الافتراضي true على الويب؛ يتوقف عند التمرير بعيدًا.
   */
  autoPlayMuted?: boolean;
};

/**
 * لقطة فيديو داخل البطاقة (ويب + جوال).
 * يستخدم محرك Native المركزي على iOS/Android.
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
  const [webInView, setWebInView] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const videoRef = useRef<VideoType | null>(null);
  const fullRef = useRef<VideoType | null>(null);
  const htmlRef = useRef<HTMLVideoElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const webVisibleRef = useRef(false);
  const observerTargetRef = useRef<HTMLVideoElement | null>(null);

  const autoplayEnabled = autoPlayMuted;
  const { containerRef, inView: nativeInView } = useInlineVideoVisibility({
    enabled: Platform.OS !== 'web' && autoplayEnabled && focused && !fullscreen,
  });

  const inView = Platform.OS === 'web' ? webInView : nativeInView;

  const nativeAutoplay = useNativeFeedVideoAutoplay({
    playerId: uri,
    active:
      autoplayEnabled && focused && inView && !fullscreen && !playbackFailed,
    playable: !!uri && /^https?:\/\//i.test(uri.trim()),
    videoRef,
  });

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
    if (Platform.OS === 'web') {
      void videoRef.current?.unloadAsync().catch(() => undefined);
      void fullRef.current?.unloadAsync().catch(() => undefined);
    }
    setFullscreen(false);
  }, [stopInline]);

  const markPlaybackFailed = useCallback((error?: unknown) => {
    if (error != null && Platform.OS !== 'web') {
      if (!shouldMarkNativePlaybackFailed(error)) return;
    }
    setPlaybackFailed(true);
    htmlRef.current?.pause();
    void videoRef.current?.pauseAsync().catch(() => undefined);
    void fullRef.current?.pauseAsync().catch(() => undefined);
    setFullscreen(false);
  }, []);

  const setupWebObserver = useCallback(
    (node: HTMLVideoElement) => {
      if (observerRef.current && observerTargetRef.current === node) return;
      observerRef.current?.disconnect();
      observerRef.current = null;
      observerTargetRef.current = node;

      if (!autoplayEnabled || typeof IntersectionObserver === 'undefined') {
        webVisibleRef.current = true;
        setWebInView(true);
        return;
      }

      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const ratio = entry?.intersectionRatio ?? 0;
          const next = nextInlineVisibilityAutoplay(
            webVisibleRef.current,
            ratio,
            INLINE_VISIBILITY_PLAY_RATIO,
            INLINE_VISIBILITY_STOP_RATIO
          );
          if (next === webVisibleRef.current) return;
          webVisibleRef.current = next;
          setWebInView(next);
        },
        {
          threshold: [
            0,
            INLINE_VISIBILITY_STOP_RATIO,
            INLINE_VISIBILITY_PLAY_RATIO,
            0.75,
            1,
          ],
        }
      );
      io.observe(node);
      observerRef.current = io;
    },
    [autoplayEnabled]
  );

  const bindWebVideo = useCallback(
    (node: HTMLVideoElement | null) => {
      if (!node) {
        observerRef.current?.disconnect();
        observerRef.current = null;
        observerTargetRef.current = null;
        if (htmlRef.current) unregisterActiveWebVideo(htmlRef.current);
        htmlRef.current = null;
        return;
      }

      htmlRef.current = node;
      node.onerror = () => markPlaybackFailed();
      node.playsInline = true;
      node.loop = true;
      node.muted = false;
      node.defaultMuted = false;
      node.volume = 1;
      setupWebObserver(node);
    },
    [markPlaybackFailed, setupWebObserver]
  );

  const shouldAutoPlay =
    autoplayEnabled && focused && inView && !fullscreen && !playbackFailed;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const attach = () => {
      const el = htmlRef.current;
      if (el) promoteWebVideoSound(el);
    };
    if (isWebMediaSoundUnlocked()) attach();
    return subscribeWebMediaSound(attach);
  }, []);

  useEffect(() => {
    setPlaybackFailed(false);
    webVisibleRef.current = false;
    setWebInView(false);
  }, [uri]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      observerTargetRef.current = null;
      htmlRef.current?.pause();
    };
  }, []);

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

  useEffect(() => {
    if (playbackFailed || Platform.OS !== 'web') return;
    const el = htmlRef.current;
    if (!el) return;
    if (shouldAutoPlay) {
      registerActiveWebVideo(el);
      void startVisibleWebVideo(el).then((result) => {
        if (result === 'failed') {
          markPlaybackFailed();
          return;
        }
        if (result === 'playing') {
          if (isWebMediaSoundUnlocked()) {
            promoteWebVideoSound(el);
          }
        }
      });
    } else {
      el.pause();
      unregisterActiveWebVideo(el);
    }
    return () => {
      unregisterActiveWebVideo(el);
    };
  }, [shouldAutoPlay, playbackFailed, markPlaybackFailed]);

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
        ref={containerRef}
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
            muted: false,
            defaultMuted: false,
            loop: true,
            playsInline: true,
            preload: 'auto',
            controls: !autoplayEnabled,
            onError: () => markPlaybackFailed(),
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
            useNativeControls={!autoplayEnabled}
            isLooping={autoplayEnabled}
            shouldPlay={false}
            isMuted={false}
            volume={1}
            onLoad={nativeAutoplay.markReady}
            onReadyForDisplay={nativeAutoplay.markReady}
            onError={(e) => {
              if (shouldMarkNativePlaybackFailed(e)) markPlaybackFailed(e);
            }}
            onPlaybackStatusUpdate={nativeAutoplay.onNativePlaybackStatusUpdate}
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
            onError={(e) => {
              if (Platform.OS === 'web' && isRealMediaFailure(e)) {
                markPlaybackFailed(e);
                return;
              }
              if (shouldMarkNativePlaybackFailed(e)) markPlaybackFailed(e);
            }}
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

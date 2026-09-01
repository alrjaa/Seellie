/**
 * Native feed video autoplay — TikTok-style single sync path.
 * Web: no-op (FullScreenFeed uses HTML video + media-autoplay-engine).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { Video } from 'expo-av';
import {
  ensureNativeFeedAudioSession,
  isNativePlaybackMediaFailure,
  isNativePlaybackStatusMediaFailure,
  pauseNativeFeedPlayer,
  pauseOtherNativeFeedPlayers,
  registerNativeFeedPlayer,
  releaseNativeFeedPlayer,
  requestNativeFeedAutoplay,
  shouldAttemptNativeFeedAutoplay,
  shouldMarkNativePlaybackFailed,
} from '@/services/native-feed-autoplay';

type Options = {
  playerId: string;
  active: boolean;
  playable: boolean;
  videoRef: React.RefObject<Video | null>;
  onPlaying?: () => void;
};

export function useNativeFeedVideoAutoplay({
  playerId,
  active,
  playable,
  videoRef,
  onPlaying,
}: Options) {
  const generationRef = useRef(0);
  const userPausedRef = useRef(false);
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;

  const [ready, setReady] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const shouldPlay = false;

  const markReady = useCallback(() => {
    setReady(true);
  }, []);

  const resetForNewMedia = useCallback(() => {
    generationRef.current += 1;
    setLoadError(false);
    setReady(false);
    userPausedRef.current = false;
    setUserPaused(false);
    void pauseNativeFeedPlayer(videoRef.current);
  }, [videoRef]);

  useEffect(() => {
    resetForNewMedia();
  }, [playerId, resetForNewMedia]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    registerNativeFeedPlayer(playerId, () => videoRef.current, generationRef.current);
    return () => {
      releaseNativeFeedPlayer(playerId);
      void pauseNativeFeedPlayer(videoRef.current);
    };
  }, [playerId, videoRef]);

  /** Single autoplay sync — active + ready → play with audio; inactive → pause + invalidate. */
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (!active) {
      generationRef.current += 1;
      userPausedRef.current = false;
      setUserPaused(false);
      void pauseNativeFeedPlayer(videoRef.current);
      return;
    }

    userPausedRef.current = false;
    setUserPaused(false);

    if (
      !shouldAttemptNativeFeedAutoplay({
        active,
        playable,
        ready,
        userPaused: false,
        loadError,
      })
    ) {
      return;
    }

    const player = videoRef.current;
    if (!player) return;

    const generation = generationRef.current;
    let cancelled = false;

    void (async () => {
      await ensureNativeFeedAudioSession();
      if (cancelled || generationRef.current !== generation) return;
      await pauseOtherNativeFeedPlayers(playerId);
      if (cancelled || generationRef.current !== generation) return;
      await requestNativeFeedAutoplay({
        playerId,
        player,
        generation,
        getGeneration: () => generationRef.current,
        onPlaying: () => onPlayingRef.current?.(),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [active, playable, ready, loadError, playerId, videoRef]);

  const toggleUserPause = useCallback(async () => {
    if (Platform.OS === 'web') return;
    const player = videoRef.current;
    if (!player) return;
    try {
      const status = await player.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        userPausedRef.current = true;
        setUserPaused(true);
        await player.pauseAsync();
        return;
      }
      userPausedRef.current = false;
      setUserPaused(false);
      const generation = generationRef.current;
      await requestNativeFeedAutoplay({
        playerId,
        player,
        generation,
        getGeneration: () => generationRef.current,
        onPlaying: () => onPlayingRef.current?.(),
      });
    } catch (error) {
      if (isNativePlaybackMediaFailure(error)) {
        setLoadError(true);
      }
    }
  }, [playerId, videoRef]);

  const onNativeError = useCallback((error: string) => {
    if (shouldMarkNativePlaybackFailed(error)) {
      setLoadError(true);
    }
  }, []);

  const onNativePlaybackStatusUpdate = useCallback(
    (status: Parameters<typeof isNativePlaybackStatusMediaFailure>[0]) => {
      if (isNativePlaybackStatusMediaFailure(status)) {
        setLoadError(true);
      }
    },
    []
  );

  return {
    ready,
    loadError,
    shouldPlay,
    isMuted: false as const,
    volume: 1 as const,
    markReady,
    toggleUserPause,
    onNativeError,
    onNativePlaybackStatusUpdate,
    setLoadError,
  };
}

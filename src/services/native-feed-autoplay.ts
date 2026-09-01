/**
 * Native feed video autoplay — iOS/Android only.
 * Independent from web media-autoplay-engine / browser policy.
 */
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import type { Video } from 'expo-av';
import { Platform } from 'react-native';
import {
  isNativePlaybackMediaFailure,
  isNativePlaybackStatusMediaFailure,
  shouldAttemptNativeFeedAutoplay,
  hasPendingNativeAutoplayRequest,
  type NativePlaybackStatus,
} from '@/services/native-feed-autoplay-policy';

export type { NativePlaybackStatus } from '@/services/native-feed-autoplay-policy';
export {
  isNativePlaybackMediaFailure,
  isNativePlaybackStatusMediaFailure,
  shouldAttemptNativeFeedAutoplay,
  hasPendingNativeAutoplayRequest,
  shouldMarkNativePlaybackFailed,
  nextInlineVisibilityAutoplay,
  computeVisibleHeightRatio,
  INLINE_VISIBILITY_PLAY_RATIO,
  INLINE_VISIBILITY_STOP_RATIO,
} from '@/services/native-feed-autoplay-policy';

export type NativeFeedAutoplayResult =
  | 'playing'
  | 'audio_restricted'
  | 'aborted'
  | 'failed';

let audioSessionReady = false;
let activeFeedPlayerId: string | null = null;

const feedPlayers = new Map<
  string,
  { getPlayer: () => Video | null; generation: number }
>();

export async function ensureNativeFeedAudioSession(): Promise<void> {
  if (Platform.OS === 'web' || audioSessionReady) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    audioSessionReady = true;
  } catch {
    /* session setup must not block playback */
  }
}

export function resetNativeFeedAutoplayForTests(): void {
  audioSessionReady = false;
  activeFeedPlayerId = null;
  feedPlayers.clear();
}

export function registerNativeFeedPlayer(
  playerId: string,
  getPlayer: () => Video | null,
  generation: number
): void {
  feedPlayers.set(playerId, { getPlayer, generation });
}

export function releaseNativeFeedPlayer(playerId: string): void {
  feedPlayers.delete(playerId);
  if (activeFeedPlayerId === playerId) {
    activeFeedPlayerId = null;
  }
}

export async function pauseNativeFeedPlayer(player: Video | null): Promise<void> {
  if (!player) return;
  try {
    await player.pauseAsync();
  } catch {
    /* ignore */
  }
}

export async function pauseOtherNativeFeedPlayers(
  activeId: string
): Promise<void> {
  for (const [id, entry] of feedPlayers) {
    if (id === activeId) continue;
    await pauseNativeFeedPlayer(entry.getPlayer());
  }
}

export type NativeFeedAutoplayRequest = {
  playerId: string;
  player: Video;
  generation: number;
  getGeneration: () => number;
  onPlaying?: () => void;
  onAudioRestricted?: () => void;
};

/**
 * Imperative native autoplay: unmuted + full volume.
 * Pauses other feed players; never throws.
 */
export async function requestNativeFeedAutoplay(
  req: NativeFeedAutoplayRequest
): Promise<NativeFeedAutoplayResult> {
  const { playerId, player, generation, getGeneration } = req;
  if (Platform.OS === 'web') return 'aborted';
  if (getGeneration() !== generation) return 'aborted';

  await ensureNativeFeedAudioSession();
  await pauseOtherNativeFeedPlayers(playerId);
  activeFeedPlayerId = playerId;

  try {
    let status = await player.getStatusAsync();
    if (!status.isLoaded) {
      await new Promise((r) => setTimeout(r, 32));
      status = await player.getStatusAsync();
    }
    if (getGeneration() !== generation) return 'aborted';

    await player.setIsMutedAsync(false);
    await player.setVolumeAsync(1);
    if (getGeneration() !== generation) return 'aborted';

    await player.playAsync();
    if (getGeneration() !== generation) {
      await pauseNativeFeedPlayer(player);
      return 'aborted';
    }

    const after = await player.getStatusAsync();
    if (after.isLoaded && after.isPlaying) {
      if (after.isMuted) {
        await player.setIsMutedAsync(false);
        const retry = await player.getStatusAsync();
        if (retry.isLoaded && retry.isMuted) {
          req.onAudioRestricted?.();
          return 'audio_restricted';
        }
      }
      req.onPlaying?.();
      return 'playing';
    }

    if (after.isLoaded && !after.isPlaying) {
      await player.playAsync();
      const retry = await player.getStatusAsync();
      if (retry.isLoaded && retry.isPlaying) {
        req.onPlaying?.();
      }
      return retry.isLoaded && retry.isPlaying ? 'playing' : 'failed';
    }

    return 'failed';
  } catch (error) {
    if (getGeneration() !== generation) return 'aborted';
    if (!isNativePlaybackMediaFailure(error)) {
      req.onAudioRestricted?.();
      try {
        const st = await player.getStatusAsync();
        if (st.isLoaded && st.isPlaying) return 'audio_restricted';
      } catch {
        /* ignore */
      }
      return 'audio_restricted';
    }
    return 'failed';
  }
}

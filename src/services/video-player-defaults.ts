/**
 * Shared HTML5 / expo-av playback defaults (P1 video unification).
 * Keep Feed/Inline/Forums/lightbox/ads on one policy surface.
 */

export const VIDEO_PLAYER_DEFAULTS = {
  playsInline: true,
  preload: 'auto' as const,
  /** Audible-first; browser may force muted — engine handles fallback. */
  preferAudible: true,
  volume: 1,
  /** After muted fallback, do not auto-unmute without a user gesture past this age. */
  lateUnmuteGuardMs: 800,
} as const;

export type ApplyWebVideoDefaultsOptions = {
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
};

/** Apply consistent attributes on a web HTMLVideoElement. */
export function applyWebVideoDefaults(
  el: HTMLVideoElement,
  options: ApplyWebVideoDefaultsOptions = {}
): void {
  el.playsInline = VIDEO_PLAYER_DEFAULTS.playsInline;
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  el.preload = options.preload ?? VIDEO_PLAYER_DEFAULTS.preload;
  el.volume = VIDEO_PLAYER_DEFAULTS.volume;
  if (typeof options.loop === 'boolean') el.loop = options.loop;
  if (typeof options.controls === 'boolean') el.controls = options.controls;
  if (typeof options.muted === 'boolean') {
    el.muted = options.muted;
    el.defaultMuted = options.muted;
  }
}

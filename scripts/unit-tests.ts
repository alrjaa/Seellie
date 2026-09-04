/**
 * اختبارات وحدات بسيطة — شغّل: npm test
 */
import assert from 'node:assert/strict';
import {
  isVideoWithinLimit,
  videoDurationSecFromPicker,
  fileSizeMbFromPicker,
  isFileWithinMbLimit,
  validatePickerAsset,
  FORUM_VIDEO_MAX_SEC,
  PROFILE_VIDEO_MAX_SEC,
  NATIVE_AD_VIDEO_MIN_SEC,
  NATIVE_AD_VIDEO_MAX_SEC,
} from '../src/utils/media-limits';
import {
  countReceivedLikes,
  getAccountSocialCounts,
  ensureSocialLists,
} from '../src/utils/social-stats';
import type { User } from '../src/data/initial-data';
import {
  sanitizeNativeAd,
  sanitizeNativeAdsPayload,
  isNativeAdLive,
  isNativeAdScheduleEnded,
  injectNativeAds,
  nativeAdToFeedItem,
  extractNativeAdId,
  filterHiddenNativeAds,
  type NativeInFeedAd,
} from '../src/services/native-ads';
import {
  hideAdInPreferences,
  reportAdInPreferences,
} from '../src/services/ad-preferences-core';
import {
  shouldFlushAdEventQueue,
  sanitizeAdEvent,
  impressionDedupeKey,
  AD_EVENT_BATCH_MAX,
} from '../src/services/ad-events-core';
import {
  appendUtmParams,
  clampAdTrimRange,
  detectAdAspectRatio,
  ensureHttpsUrl,
  isSupportedAdVideoFormat,
  isValidAdCtaUrl,
  looksLikeWebsiteNotVideo,
  reviewAdVideo,
} from '../src/utils/ad-video-studio';
import {
  sanitizeAdvertiserNotification,
  sanitizeAdvertiserNotifications,
} from '../src/services/advertiser-inbox';
import { createKeyedChannelHub } from '../src/services/app-blob-realtime-hub';
import {
  attachSoundToPlayingVideo,
  nextWebSoundSession,
  startVisibleWebVideo,
} from '../src/services/web-media-sound';
import {
  attemptAudibleAutoplay,
  attemptMutedAutoplay,
  attemptUnmuteWhilePlaying,
  classifyPlayError,
  isRealMediaFailure,
} from '../src/services/media-autoplay-engine';
import {
  isNativePlaybackMediaFailure,
  shouldAttemptNativeFeedAutoplay,
  hasPendingNativeAutoplayRequest,
  shouldMarkNativePlaybackFailed,
  nextInlineVisibilityAutoplay,
  computeVisibleHeightRatio,
  isStalePlayGeneration,
  shouldPauseOnDeactivate,
  INLINE_VISIBILITY_PLAY_RATIO,
  INLINE_VISIBILITY_STOP_RATIO,
} from '../src/services/native-feed-autoplay-policy';
import {
  claimFloatingScrollSource,
  forceFloatingVisible,
  getFloatingScrollDirection,
  getFloatingScrollPhase,
  getFloatingVisibilityProgress,
  noteFloatingMomentumScrollEnd,
  noteFloatingScrollOffset,
  releaseFloatingScrollSource,
} from '../src/services/floating-scroll-bus';
import { TRACKED_LEAGUES } from '../src/services/sports-data/leagues';
import {
  computePrivateUnreadCount,
  computeThreadUnreadCount,
  isIncomingMessageUnread,
  readTimestampForThread,
} from '../src/services/private-read-state';
import type { PrivateSpaceState } from '../src/services/private-space';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

test('videoDurationSecFromPicker ms vs sec', () => {
  assert.equal(videoDurationSecFromPicker(30000), 30);
  assert.equal(videoDurationSecFromPicker(25), 25);
  assert.equal(videoDurationSecFromPicker(null), null);
});

test('isVideoWithinLimit respects forum max', () => {
  assert.equal(isVideoWithinLimit(29, FORUM_VIDEO_MAX_SEC), true);
  assert.equal(isVideoWithinLimit(45, FORUM_VIDEO_MAX_SEC), false);
  assert.equal(isVideoWithinLimit(null, FORUM_VIDEO_MAX_SEC), true);
});

test('file size limits', () => {
  assert.equal(fileSizeMbFromPicker(5 * 1024 * 1024), 5);
  assert.equal(isFileWithinMbLimit(4.9, 5), true);
  assert.equal(isFileWithinMbLimit(6, 5), false);
});

test('validatePickerAsset video duration', () => {
  const ok = validatePickerAsset('video', {
    uri: 'x',
    duration: PROFILE_VIDEO_MAX_SEC * 1000,
    fileSize: 10 * 1024 * 1024,
  });
  assert.equal(ok.ok, true);
  const bad = validatePickerAsset('video', {
    uri: 'x',
    duration: 120 * 1000,
    fileSize: 10 * 1024 * 1024,
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, 'duration');
});

test('social counts', () => {
  const user = ensureSocialLists({
    id: 'u1',
    name: 'T',
    email: 't@t.com',
    passwordHash: 'x',
    role: 'follower',
    status: 'active',
    handle: '@t',
    visibleId: 'FOL-9',
    posts: [{ id: 'p1', text: 'hi', timestamp: new Date(), likes: ['a', 'b'] }],
    media: {
      photos: [{ id: 'ph1', url: 'u', likes: ['a'], comments: [] }],
      videos: [],
    },
    personalityPhotos: [],
    permissions: {
      canComment: true,
      canUseVoice: true,
      canNominateToPersonality: false,
      canCreateContent: false,
    },
    analysisContent: [],
    comments: [],
    followers: ['x', 'y'],
    following: ['z'],
  } as User);

  assert.equal(countReceivedLikes(user), 3);
  const counts = getAccountSocialCounts(user);
  assert.equal(counts.likes, 3);
  assert.equal(counts.followers, 2);
  assert.equal(counts.following, 1);
});

function sampleAd(over: Partial<NativeInFeedAd> = {}): NativeInFeedAd {
  return {
    id: 'ad1',
    status: 'active',
    advertiserName: 'Brand',
    videoUrl: 'https://cdn.example.com/ad.mp4',
    durationSec: 10,
    placements: ['general'],
    insertEveryN: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    hookText: 'Stop scrolling',
    ...over,
  };
}

test('native ad sanitizer requires https video and name', () => {
  assert.equal(
    sanitizeNativeAd({
      id: 'x',
      advertiserName: 'A',
      videoUrl: 'http://insecure.example/a.mp4',
    }),
    null
  );
  const ok = sanitizeNativeAd(sampleAd({ ctaUrl: 'https://brand.example/x' }));
  assert.ok(ok);
  assert.equal(ok?.ctaUrl, 'https://brand.example/x');
});

test('native ad duration clamped to 6–15s', () => {
  const short = sanitizeNativeAd(sampleAd({ durationSec: 2 }));
  const long = sanitizeNativeAd(sampleAd({ durationSec: 90 }));
  assert.equal(short?.durationSec, NATIVE_AD_VIDEO_MIN_SEC);
  assert.equal(long?.durationSec, NATIVE_AD_VIDEO_MAX_SEC);
});

test('native ad payload drops duplicates and junk', () => {
  const list = sanitizeNativeAdsPayload([
    sampleAd({ id: 'a' }),
    sampleAd({ id: 'a' }),
    { id: 'b' },
    sampleAd({ id: 'c', status: 'paused' }),
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'a');
  assert.equal(list[1].id, 'c');
});

test('native ad live window and status', () => {
  const now = Date.parse('2026-06-01T12:00:00.000Z');
  assert.equal(isNativeAdLive(sampleAd({ status: 'draft' }), now), false);
  assert.equal(
    isNativeAdLive(sampleAd({ startAt: '2026-07-01T00:00:00.000Z' }), now),
    false
  );
  assert.equal(isNativeAdLive(sampleAd(), now), true);
  assert.equal(
    isNativeAdLive(sampleAd({ endAt: '2026-05-31T23:59:59.000Z' }), now),
    false
  );
  // Date-only end day is inclusive through end of that UTC day
  assert.equal(
    isNativeAdLive(sampleAd({ endAt: '2026-06-01' }), now),
    true
  );
  assert.equal(
    isNativeAdLive(
      sampleAd({ endAt: '2026-06-01' }),
      Date.parse('2026-06-02T00:00:00.000Z')
    ),
    false
  );
});

test('native ad schedule ended does not delete advertiser ownership concept', () => {
  const now = Date.parse('2026-06-02T00:00:00.000Z');
  assert.equal(
    isNativeAdScheduleEnded(sampleAd({ endAt: '2026-06-01' }), now),
    true
  );
  assert.equal(
    isNativeAdScheduleEnded({ end_at: '2026-06-01T12:00:00.000Z' }, now),
    true
  );
  assert.equal(isNativeAdScheduleEnded(sampleAd({ endAt: undefined }), now), false);
});

test('inject native ads every N items', () => {
  const items = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
  const out = injectNativeAds(items, [sampleAd()], 'general');
  assert.equal(out.length, 6);
  assert.equal((out[2] as { id: string }).id, 'native-ad-ad1--0');
  assert.equal((out[5] as { id: string }).id, 'native-ad-ad1--1');
  const slide = nativeAdToFeedItem(sampleAd());
  assert.equal(slide.sponsored, true);
  assert.equal(slide.kind, 'video');
});

test('inject native ads never drops organic items on junk catalog', () => {
  const items = [{ id: 'post-1' }, { id: 'post-2' }];
  const junk = injectNativeAds(items, null as unknown as NativeInFeedAd[], 'general');
  assert.equal(junk.length, 2);
  assert.equal((junk[0] as { id: string }).id, 'post-1');
  const broken = injectNativeAds(
    items,
    [{ id: 'bad' } as unknown as NativeInFeedAd],
    'general'
  );
  assert.equal(broken.length, 2);
  const noPlacement = injectNativeAds(
    items,
    [sampleAd({ placements: undefined as unknown as NativeInFeedAd['placements'] })],
    'general'
  );
  assert.equal(noPlacement.length, 2);
});

test('filterHiddenNativeAds tolerates missing hidden ids', () => {
  const ads = [sampleAd({ id: 'a' })];
  assert.equal(filterHiddenNativeAds(ads, null).length, 1);
  assert.equal(filterHiddenNativeAds(ads, undefined).length, 1);
});

test('validatePickerAsset native ad min duration', () => {
  const tooShort = validatePickerAsset('nativeAdVideo', {
    uri: 'x',
    duration: 3000,
    fileSize: 2 * 1024 * 1024,
  });
  assert.equal(tooShort.ok, false);
  const ok = validatePickerAsset('nativeAdVideo', {
    uri: 'x',
    duration: 8000,
    fileSize: 2 * 1024 * 1024,
  });
  assert.equal(ok.ok, true);
});

test('extractNativeAdId parses slot ids', () => {
  assert.equal(extractNativeAdId('native-ad-ad1--0'), 'ad1');
  assert.equal(extractNativeAdId('native-ad-ad1'), 'ad1');
  assert.equal(extractNativeAdId('post-1'), null);
});

test('filterHiddenNativeAds removes hidden ids', () => {
  const ads = [sampleAd({ id: 'a' }), sampleAd({ id: 'b' })];
  const out = filterHiddenNativeAds(ads, ['a']);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.id, 'b');
});

test('ad preferences hide and report', () => {
  const hidden = hideAdInPreferences(
    { hiddenAdIds: [], reportedAdIds: [], personalizedAds: true },
    'x'
  );
  assert.deepEqual(hidden.hiddenAdIds, ['x']);
  const reported = reportAdInPreferences(hidden, 'y');
  assert.ok(reported.hiddenAdIds.includes('y'));
  assert.ok(reported.reportedAdIds.includes('y'));
});

test('impression dedupe is per ad placement and session', () => {
  const a = impressionDedupeKey('ad1', 'sess', 'general');
  const b = impressionDedupeKey('ad1', 'sess', 'unique');
  const c = impressionDedupeKey('ad1', 'sess', 'general');
  assert.notEqual(a, b);
  assert.equal(a, c);
});

test('ad event batch flush thresholds', () => {
  assert.equal(shouldFlushAdEventQueue(0, 0, 1000), false);
  assert.equal(shouldFlushAdEventQueue(AD_EVENT_BATCH_MAX, 0, 1000), true);
  assert.equal(shouldFlushAdEventQueue(1, 0, 31_000), true);
  const row = sanitizeAdEvent({
    adId: 'a',
    event: 'impression',
    placement: 'general',
  });
  assert.ok(row);
  assert.equal(sanitizeAdEvent({ adId: '', event: 'click' }), null);
});

test('ad studio aspect and format', () => {
  assert.equal(detectAdAspectRatio(1080, 1920), '9:16');
  assert.equal(detectAdAspectRatio(1080, 1080), '1:1');
  assert.equal(detectAdAspectRatio(1920, 1080), '16:9');
  assert.equal(isSupportedAdVideoFormat('https://cdn.example/a.mp4'), true);
  assert.equal(isSupportedAdVideoFormat('https://cdn.example/a.avi'), false);
  assert.equal(looksLikeWebsiteNotVideo('https://www.seellie.com'), true);
  assert.equal(looksLikeWebsiteNotVideo('https://seellie.com/'), true);
  assert.equal(looksLikeWebsiteNotVideo('seellie.com'), true);
  assert.equal(looksLikeWebsiteNotVideo('https://cdn.example/a.mp4'), false);
  const siteAsVideo = reviewAdVideo({
    probe: { durationSec: null, width: null, height: null, sizeMb: null },
    uri: 'https://www.seellie.com',
    ctaUrl: '',
    requireCta: true,
  });
  assert.ok(siteAsVideo.some((c) => c.code === 'website_not_video'));
});

test('ensureHttpsUrl upgrades http and bare domains', () => {
  assert.equal(ensureHttpsUrl('https://seellie.com/x'), 'https://seellie.com/x');
  assert.equal(ensureHttpsUrl('http://seellie.com/x'), 'https://seellie.com/x');
  assert.equal(ensureHttpsUrl('seellie.com/offer'), 'https://seellie.com/offer');
  assert.equal(ensureHttpsUrl('blob:https://seellie.com/1'), 'blob:https://seellie.com/1');
});

test('ad studio review blocks bad duration and link', () => {
  const short = reviewAdVideo({
    probe: { durationSec: 3, width: 1080, height: 1920, sizeMb: 4 },
    uri: 'https://cdn.example/a.mp4',
  });
  assert.ok(short.some((c) => c.code === 'duration_short'));
  assert.equal(isValidAdCtaUrl('https://play.google.com/store/apps'), true);
  assert.equal(isValidAdCtaUrl('javascript:alert(1)'), false);
  const utm = appendUtmParams('https://seellie.com/offer', {
    source: 'seellie',
    medium: 'in_feed',
    campaign: 'spring',
  });
  assert.match(utm, /utm_source=seellie/);
});

test('advertiser inbox sanitizer keeps blocked/deleted notices only', () => {
  const blocked = sanitizeAdvertiserNotification({
    id: '11111111-1111-4111-8111-111111111111',
    advertiser_id: '22222222-2222-4222-8222-222222222222',
    kind: 'blocked',
    ad_title: 'Spring offer',
    note: 'Policy',
    created_at: '2026-08-19T00:00:00.000Z',
  });
  assert.ok(blocked);
  assert.equal(blocked?.kind, 'blocked');
  assert.equal(sanitizeAdvertiserNotification({ kind: 'blocked' }), null);
  assert.equal(
    sanitizeAdvertiserNotifications([
      blocked,
      { kind: 'hack' },
      { ...blocked, kind: 'deleted', id: '33333333-3333-4333-8333-333333333333' },
    ]).length,
    2
  );
});

test('ad studio trim clamps to 6–15s', () => {
  const t1 = clampAdTrimRange(0, 40, 40);
  assert.equal(t1.end - t1.start, 15);
  const t2 = clampAdTrimRange(0, 2, 20);
  assert.ok(t2.end - t2.start >= 6);
});

test('app blob realtime hub shares one channel across consumers', () => {
  let startCount = 0;
  let stopCount = 0;
  const startedKeys: string[] = [];
  const hub = createKeyedChannelHub({
    start: (key) => {
      startCount += 1;
      startedKeys.push(key);
      return { key };
    },
    stop: () => {
      stopCount += 1;
    },
  });
  const a = hub.subscribe('native_ads', () => undefined);
  const b = hub.subscribe('native_ads', () => undefined);
  const c = hub.subscribe('settings', () => undefined);
  assert.equal(startCount, 2);
  assert.deepEqual(startedKeys, ['native_ads', 'settings']);
  assert.equal(hub.listenerCount('native_ads'), 2);
  assert.equal(hub.listenerCount('settings'), 1);
  assert.equal(hub.activeKeyCount(), 2);
  a();
  assert.equal(stopCount, 0);
  assert.equal(hub.listenerCount('native_ads'), 1);
  b();
  assert.equal(stopCount, 1);
  assert.equal(hub.listenerCount('native_ads'), 0);
  c();
  assert.equal(stopCount, 2);
  assert.equal(hub.activeKeyCount(), 0);
});

test('app blob realtime hub fans out without re-starting the channel', () => {
  let dispatch: () => void = () => undefined;
  let startCount = 0;
  const hub = createKeyedChannelHub({
    start: (_key, next) => {
      startCount += 1;
      dispatch = next;
      return {};
    },
    stop: () => undefined,
  });
  let a = 0;
  let b = 0;
  hub.subscribe('native_ads', () => {
    a += 1;
  });
  hub.subscribe('native_ads', () => {
    b += 1;
  });
  dispatch();
  assert.equal(startCount, 1);
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test('web media sound stays unlocked across feed items', () => {
  assert.equal(nextWebSoundSession(false, 'item_change'), false);
  assert.equal(nextWebSoundSession(true, 'item_change'), true);
  assert.equal(nextWebSoundSession(false, 'unlock'), true);
});

test('visible video tries audible autoplay first', async () => {
  const plays: boolean[] = [];
  const el = {
    muted: true,
    defaultMuted: true,
    volume: 0,
    paused: true,
    play: async () => {
      plays.push(el.muted);
      el.paused = false;
    },
  };
  assert.equal(await attemptAudibleAutoplay(el), 'playing_audible');
  assert.equal(el.muted, false);
  assert.equal(el.paused, false);
  assert.deepEqual(plays, [false]);
});

test('audible autoplay falls back to muted when policy blocks', async () => {
  const el = {
    muted: false,
    defaultMuted: false,
    volume: 1,
    paused: true,
    play: async () => {
      if (!el.muted) {
        throw Object.assign(new Error('not allowed'), { name: 'NotAllowedError' });
      }
      el.paused = false;
    },
  };
  assert.equal(await attemptAudibleAutoplay(el), 'playing_muted');
  assert.equal(el.muted, true);
  assert.equal(el.paused, false);
});

test('startVisibleWebVideo uses audible-first path', async () => {
  const el = {
    muted: false,
    defaultMuted: false,
    volume: 1,
    paused: true,
    play: async () => {
      el.paused = false;
    },
  };
  assert.equal(await startVisibleWebVideo(el), 'playing');
  assert.equal(el.muted, false);
});

test('attach sound never leaves a playing video paused', () => {
  let muted = true;
  let paused = false;
  const el = {
    volume: 1,
    defaultMuted: true,
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      muted = value;
      if (value === false) paused = true;
    },
    get paused() {
      return paused;
    },
    play() {
      paused = false;
    },
  };
  assert.equal(attachSoundToPlayingVideo(el), 'muted');
  assert.equal(el.muted, true);
  assert.equal(el.paused, false);
});

test('attach sound keeps playback when unmute is allowed', () => {
  const el = {
    muted: true,
    defaultMuted: true,
    volume: 1,
    paused: false,
    play() {
      return undefined;
    },
  };
  assert.equal(attachSoundToPlayingVideo(el), 'unmuted');
  assert.equal(el.muted, false);
  assert.equal(el.paused, false);
});

test('classify NotAllowedError as autoplay policy not media failure', () => {
  assert.equal(
    classifyPlayError({ name: 'NotAllowedError', message: 'play() failed' }),
    'policy'
  );
  assert.equal(isRealMediaFailure({ name: 'NotAllowedError' }), false);
});

test('classify AbortError as transition race not media failure', () => {
  assert.equal(
    classifyPlayError({ name: 'AbortError', message: 'interrupted' }),
    'abort'
  );
  assert.equal(isRealMediaFailure({ name: 'AbortError' }), false);
});

test('muted autoplay starts without treating policy block as failure', async () => {
  const el = {
    muted: false,
    defaultMuted: false,
    volume: 0,
    paused: true,
    play: async () => {
      el.paused = false;
    },
  };
  assert.equal(await attemptMutedAutoplay(el), 'playing');
  assert.equal(el.muted, true);
});

test('stale play generation aborts without media failure', async () => {
  let gen = 0;
  const el = {
    muted: true,
    defaultMuted: true,
    volume: 1,
    paused: true,
    play: async () => {
      gen += 1;
      el.paused = false;
    },
  };
  const result = await attemptMutedAutoplay(el, {
    generation: 0,
    getGeneration: () => gen,
  });
  assert.equal(result, 'aborted');
});

test('unmute after user activation keeps video playing when blocked', () => {
  let muted = true;
  let paused = false;
  const el = {
    volume: 1,
    defaultMuted: true,
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      muted = value;
      if (value === false) paused = true;
    },
    get paused() {
      return paused;
    },
    play() {
      paused = false;
    },
  };
  assert.equal(attemptUnmuteWhilePlaying(el), 'muted_still_playing');
  assert.equal(el.muted, true);
  assert.equal(el.paused, false);
});

test('unmute in user gesture plays paused video with sound', () => {
  let muted = true;
  let paused = true;
  const el = {
    volume: 1,
    defaultMuted: true,
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      muted = value;
    },
    get paused() {
      return paused;
    },
    play() {
      paused = false;
    },
  };
  assert.equal(attemptUnmuteWhilePlaying(el, { inGesture: true }), 'unmuted');
  assert.equal(el.muted, false);
  assert.equal(el.paused, false);
});

test('native feed shouldAttemptNativeFeedAutoplay requires ready + active', () => {
  assert.equal(
    shouldAttemptNativeFeedAutoplay({
      active: true,
      playable: true,
      ready: false,
      userPaused: false,
      loadError: false,
    }),
    false
  );
  assert.equal(
    shouldAttemptNativeFeedAutoplay({
      active: true,
      playable: true,
      ready: true,
      userPaused: false,
      loadError: false,
    }),
    true
  );
});

test('native playback media failure ignores abort errors', () => {
  assert.equal(isNativePlaybackMediaFailure(new Error('Playback interrupted')), false);
  assert.equal(isNativePlaybackMediaFailure(new Error('Network failed')), true);
});

test('native policy/autoplay errors are not media failures', () => {
  assert.equal(shouldMarkNativePlaybackFailed(new Error('NotAllowedError')), false);
  assert.equal(shouldMarkNativePlaybackFailed(new Error('autoplay blocked')), false);
  assert.equal(shouldMarkNativePlaybackFailed(new Error('decode error')), true);
});

test('native feed autoplay starts with audio enabled when ready', () => {
  assert.equal(
    shouldAttemptNativeFeedAutoplay({
      active: true,
      playable: true,
      ready: true,
      userPaused: false,
      loadError: false,
    }),
    true
  );
  assert.equal(
    shouldAttemptNativeFeedAutoplay({
      active: true,
      playable: true,
      ready: true,
      userPaused: true,
      loadError: false,
    }),
    false
  );
});

test('inline visibility hysteresis play at 50% stop at 20%', () => {
  assert.equal(
    nextInlineVisibilityAutoplay(false, INLINE_VISIBILITY_PLAY_RATIO - 0.01),
    false
  );
  assert.equal(
    nextInlineVisibilityAutoplay(false, INLINE_VISIBILITY_PLAY_RATIO),
    true
  );
  assert.equal(
    nextInlineVisibilityAutoplay(true, INLINE_VISIBILITY_STOP_RATIO),
    false
  );
  assert.equal(
    nextInlineVisibilityAutoplay(true, INLINE_VISIBILITY_STOP_RATIO + 0.01),
    true
  );
});

test('computeVisibleHeightRatio measures intersection', () => {
  assert.equal(computeVisibleHeightRatio(0, 200, 800), 1);
  assert.equal(computeVisibleHeightRatio(-50, 200, 800), 0.75);
  assert.equal(computeVisibleHeightRatio(700, 200, 800), 0.5);
});

test('stale native play generation is detected', () => {
  assert.equal(isStalePlayGeneration(0, 1), true);
  assert.equal(isStalePlayGeneration(2, 2), false);
});

test('native feed pauses when slide deactivates', () => {
  assert.equal(shouldPauseOnDeactivate(false), true);
  assert.equal(shouldPauseOnDeactivate(true), false);
});

test('pending native autoplay when active before ready', () => {
  assert.equal(
    hasPendingNativeAutoplayRequest({
      active: true,
      playable: true,
      ready: false,
      userPaused: false,
      loadError: false,
    }),
    true
  );
  assert.equal(
    shouldAttemptNativeFeedAutoplay({
      active: true,
      playable: true,
      ready: false,
      userPaused: false,
      loadError: false,
    }),
    false
  );
  assert.equal(
    shouldAttemptNativeFeedAutoplay({
      active: true,
      playable: true,
      ready: true,
      userPaused: false,
      loadError: false,
    }),
    true
  );
});

test('floating scroll bus tracks direction while scrolling', () => {
  const source = 'test:fab-direction';
  claimFloatingScrollSource(source);
  forceFloatingVisible();
  assert.equal(getFloatingScrollPhase(), 'idle');
  assert.equal(getFloatingVisibilityProgress(), 1);

  noteFloatingScrollOffset(source, 0);
  noteFloatingScrollOffset(source, 40);
  assert.equal(getFloatingScrollPhase(), 'scrolling');
  assert.equal(getFloatingScrollDirection(), 'down');
  assert.ok(getFloatingVisibilityProgress() < 0.5);

  noteFloatingScrollOffset(source, 10);
  assert.equal(getFloatingScrollDirection(), 'up');
  assert.ok(getFloatingVisibilityProgress() > 0.15);

  noteFloatingMomentumScrollEnd(source);
  releaseFloatingScrollSource(source);
});

test('tracked leagues include Saudi, Bundesliga, and MLS', () => {
  const ids = TRACKED_LEAGUES.map((l) => l.leagueId);
  assert.ok(ids.includes(307));
  assert.ok(ids.includes(78));
  assert.ok(ids.includes(253));
  assert.equal(TRACKED_LEAGUES.length, 7);
});

test('private unread counts respect lastReadAt per thread', () => {
  const space: PrivateSpaceState = {
    friendIds: ['f1'],
    chats: {
      f1: [
        {
          id: 'm1',
          fromMe: false,
          text: 'old',
          at: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 'm2',
          fromMe: false,
          text: 'new',
          at: '2026-01-02T10:00:00.000Z',
        },
        {
          id: 'm3',
          fromMe: true,
          text: 'mine',
          at: '2026-01-02T11:00:00.000Z',
        },
      ],
    },
    items: [],
  };
  assert.equal(
    computeThreadUnreadCount(space.chats.f1, '2026-01-01T12:00:00.000Z'),
    1
  );
  assert.equal(
    computePrivateUnreadCount(space, {
      f1: '2026-01-02T10:00:00.000Z',
    }),
    0
  );
  assert.equal(readTimestampForThread(space.chats.f1), '2026-01-02T11:00:00.000Z');
});

test('isIncomingMessageUnread ignores outgoing and respects lastReadAt', () => {
  const msg = {
    id: 'm2',
    fromMe: false,
    text: 'hi',
    at: '2026-01-02T10:00:00.000Z',
  };
  assert.equal(isIncomingMessageUnread(msg, '2026-01-01T00:00:00.000Z'), true);
  assert.equal(isIncomingMessageUnread(msg, '2026-01-02T10:00:00.000Z'), false);
  assert.equal(
    isIncomingMessageUnread({ ...msg, fromMe: true }, undefined),
    false
  );
});

console.log('All tests passed.');

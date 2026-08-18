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
  reviewAdVideo,
} from '../src/utils/ad-video-studio';
import { createKeyedChannelHub } from '../src/services/app-blob-realtime-hub';

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
  assert.match(utm, /utm_campaign=spring/);
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

console.log('All tests passed.');

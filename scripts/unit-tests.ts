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
  type NativeInFeedAd,
} from '../src/services/native-ads';

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
  assert.equal((out[2] as { id: string }).id, 'native-ad-ad1');
  assert.equal((out[5] as { id: string }).id, 'native-ad-ad1');
  const slide = nativeAdToFeedItem(sampleAd());
  assert.equal(slide.sponsored, true);
  assert.equal(slide.kind, 'video');
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

console.log('All tests passed.');

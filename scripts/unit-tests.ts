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
} from '../src/utils/media-limits';
import {
  countReceivedLikes,
  getAccountSocialCounts,
  ensureSocialLists,
} from '../src/utils/social-stats';
import type { User } from '../src/data/initial-data';

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

console.log('All tests passed.');

/** حدود رفع الوسائط — تُعرض أثناء الرفع وتُفرض عند الاختيار */

export type MediaUploadKind =
  | 'photo'
  | 'avatar'
  | 'icon'
  | 'logo'
  | 'certificate'
  | 'video'
  | 'forumVideo'
  | 'analysisVideo'
  | 'nativeAdVideo';

export type ImageMediaSpec = {
  kind: 'image';
  width: number;
  height: number;
  maxMb: number;
  formats: string;
  aspectLabel: string;
};

export type VideoMediaSpec = {
  kind: 'video';
  maxDurationSec: number;
  minDurationSec?: number;
  width: number;
  height: number;
  maxMb: number;
  formats: string;
};

export type MediaSpec = ImageMediaSpec | VideoMediaSpec;

export const MEDIA_SPECS: Record<MediaUploadKind, MediaSpec> = {
  photo: {
    kind: 'image',
    width: 1080,
    height: 1080,
    maxMb: 5,
    formats: 'JPG, PNG, WEBP',
    aspectLabel: '1:1',
  },
  avatar: {
    kind: 'image',
    width: 512,
    height: 512,
    maxMb: 2,
    formats: 'JPG, PNG',
    aspectLabel: '1:1',
  },
  icon: {
    kind: 'image',
    width: 512,
    height: 512,
    maxMb: 1,
    formats: 'PNG',
    aspectLabel: '1:1',
  },
  logo: {
    kind: 'image',
    width: 1024,
    height: 1024,
    maxMb: 2,
    formats: 'PNG, JPG',
    aspectLabel: '1:1',
  },
  certificate: {
    kind: 'image',
    width: 900,
    height: 674,
    maxMb: 3,
    formats: 'JPG, PNG',
    aspectLabel: '900×674',
  },
  video: {
    kind: 'video',
    maxDurationSec: 60,
    width: 1920,
    height: 1080,
    maxMb: 50,
    formats: 'MP4, MOV',
  },
  forumVideo: {
    kind: 'video',
    maxDurationSec: 30,
    width: 1080,
    height: 1920,
    maxMb: 30,
    formats: 'MP4, MOV',
  },
  analysisVideo: {
    kind: 'video',
    maxDurationSec: 180,
    width: 1920,
    height: 1080,
    maxMb: 80,
    formats: 'MP4, MOV',
  },
  nativeAdVideo: {
    kind: 'video',
    minDurationSec: 6,
    maxDurationSec: 15,
    width: 1080,
    height: 1920,
    maxMb: 25,
    formats: 'MP4, MOV',
  },
};

/** توافق مع حد الساحات السابق */
export const FORUM_VIDEO_MAX_SEC = (MEDIA_SPECS.forumVideo as VideoMediaSpec)
  .maxDurationSec;
export const FORUM_VIDEO_MAX_MS = FORUM_VIDEO_MAX_SEC * 1000;
export const PROFILE_VIDEO_MAX_SEC = (MEDIA_SPECS.video as VideoMediaSpec)
  .maxDurationSec;
export const ANALYSIS_VIDEO_MAX_SEC = (
  MEDIA_SPECS.analysisVideo as VideoMediaSpec
).maxDurationSec;
export const NATIVE_AD_VIDEO_MIN_SEC = (
  MEDIA_SPECS.nativeAdVideo as VideoMediaSpec
).minDurationSec!;
export const NATIVE_AD_VIDEO_MAX_SEC = (
  MEDIA_SPECS.nativeAdVideo as VideoMediaSpec
).maxDurationSec;

/**
 * مدة أصل ImagePicker تكون بالميلي ثانية.
 * إن كانت القيمة صغيرة جداً نفترض أنها بالثواني (توافق بعض المنصات).
 */
export function videoDurationSecFromPicker(
  durationMsOrSec?: number | null
): number | null {
  if (
    durationMsOrSec == null ||
    !Number.isFinite(durationMsOrSec) ||
    durationMsOrSec <= 0
  ) {
    return null;
  }
  if (durationMsOrSec < 1000) return durationMsOrSec;
  return durationMsOrSec / 1000;
}

export function isVideoWithinLimit(
  durationSec: number | null,
  maxSec: number
): boolean {
  if (durationSec == null) return true;
  return durationSec <= maxSec + 0.5;
}

export function isForumVideoWithinLimit(durationSec: number | null): boolean {
  return isVideoWithinLimit(durationSec, FORUM_VIDEO_MAX_SEC);
}

/** حجم الملف بالميجابايت من أصل ImagePicker (fileSize بالبايت) */
export function fileSizeMbFromPicker(fileSizeBytes?: number | null): number | null {
  if (fileSizeBytes == null || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return null;
  }
  return fileSizeBytes / (1024 * 1024);
}

export function isFileWithinMbLimit(
  sizeMb: number | null,
  maxMb: number
): boolean {
  if (sizeMb == null) return true;
  return sizeMb <= maxMb + 0.05;
}

export type PickerAssetLike = {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number | null;
  duration?: number | null;
};

export type MediaValidationResult =
  | { ok: true }
  | { ok: false; reason: 'duration' | 'size' | 'dimensions'; max?: number };

/** تحقق محلي من المدة/الحجم (والأبعاد عند توفرها) */
export function validatePickerAsset(
  kind: MediaUploadKind,
  asset: PickerAssetLike
): MediaValidationResult {
  const spec = MEDIA_SPECS[kind];
  const sizeMb = fileSizeMbFromPicker(asset.fileSize ?? null);

  if (!isFileWithinMbLimit(sizeMb, spec.maxMb)) {
    return { ok: false, reason: 'size', max: spec.maxMb };
  }

  if (spec.kind === 'video') {
    const durationSec = videoDurationSecFromPicker(asset.duration);
    if (!isVideoWithinLimit(durationSec, spec.maxDurationSec)) {
      return { ok: false, reason: 'duration', max: spec.maxDurationSec };
    }
    if (
      spec.minDurationSec != null &&
      durationSec != null &&
      durationSec + 0.5 < spec.minDurationSec
    ) {
      return { ok: false, reason: 'duration', max: spec.minDurationSec };
    }
  }

  if (
    spec.kind === 'image' &&
    kind !== 'avatar' &&
    asset.width &&
    asset.height &&
    (asset.width < spec.width * 0.4 || asset.height < spec.height * 0.4)
  ) {
    // تحذير خفيف: نسمح إن كانت أصغر بكثير فقط كرفض للصور الصغيرة جداً
    // الأفاتار يُقصّ مربعاً عبر allowsEditing — لا نرفضه بالأبعاد
    return { ok: false, reason: 'dimensions', max: spec.width };
  }

  return { ok: true };
}


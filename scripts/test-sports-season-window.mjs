/**
 * اختبار دورة انتقال المواسم — بدون شبكة.
 * تشغيل: node scripts/test-sports-season-window.mjs
 */

function windowFromAvailableSeasons(seasonsWithData) {
  const cleaned = [...new Set(seasonsWithData.filter((y) => y >= 1990))].sort(
    (a, b) => b - a
  );
  if (!cleaned.length) return null;
  return { current: cleaned[0], previous: cleaned[1] ?? null };
}

function rotateToNewSeason(existing, newlyAvailableSeason) {
  if (!existing) {
    return {
      window: { current: newlyAvailableSeason, previous: null },
      purgeSeason: null,
      rotated: false,
    };
  }
  if (newlyAvailableSeason <= existing.current) {
    return { window: existing, purgeSeason: null, rotated: false };
  }
  return {
    window: {
      current: newlyAvailableSeason,
      previous: existing.current,
    },
    purgeSeason: existing.previous,
    rotated: true,
  };
}

function mergeWindowWithDiscovery(existing, seasonsWithData) {
  const discovered = windowFromAvailableSeasons(seasonsWithData);
  if (!discovered) {
    return {
      window: existing ?? { current: 0, previous: null },
      purgeSeason: null,
      rotated: false,
    };
  }
  if (!existing || !existing.current) {
    return { window: discovered, purgeSeason: null, rotated: false };
  }
  if (discovered.current > existing.current) {
    return rotateToNewSeason(existing, discovered.current);
  }
  if (existing.previous == null && discovered.previous != null) {
    return {
      window: { current: existing.current, previous: discovered.previous },
      purgeSeason: null,
      rotated: false,
    };
  }
  return { window: existing, purgeSeason: null, rotated: false };
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

// اكتشاف موسمين معاً → حالي+سابق
let r = mergeWindowWithDiscovery(null, [2024, 2023]);
assert(r.window.current === 2024 && r.window.previous === 2023, 'discover two seasons');

// سيناريو: 2025 سابق، 2026 حالي
let window = { current: 2026, previous: 2025 };
r = rotateToNewSeason(window, 2026);
assert(!r.rotated && r.purgeSeason === null, 'no rotate on same season');

r = rotateToNewSeason(window, 2027);
assert(r.rotated && r.window.current === 2027 && r.window.previous === 2026, 'rotate to 2027');
assert(r.purgeSeason === 2025, 'purge only 2025');

// ملء السابق إن كان فارغاً واكتشفنا ثاني موسم
r = mergeWindowWithDiscovery({ current: 2024, previous: null }, [2024, 2023]);
assert(r.window.previous === 2023 && !r.rotated, 'fill previous without rotate');

if (process.exitCode) {
  console.error('Season window tests failed');
  process.exit(1);
}
console.log('All season-window tests passed');

/**
 * اختبار دورة انتقال المواسم — بدون شبكة.
 * تشغيل: node scripts/test-sports-season-window.mjs
 */

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

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

// سيناريو: 2025 سابق، 2026 حالي
let window = { current: 2026, previous: 2025 };
assert(window.current === 2026 && window.previous === 2025, 'start window 2025+2026');

// فشل API مؤقت — لا تدوير
let r = rotateToNewSeason(window, 2026);
assert(!r.rotated && r.purgeSeason === null, 'no rotate on same season');
assert(r.window.current === 2026 && r.window.previous === 2025, 'window unchanged on failure path');

// موسم أقدم يظهر في API — لا حذف ولا تدوير للخلف
r = rotateToNewSeason(window, 2024);
assert(!r.rotated && r.purgeSeason === null, 'no rotate to older season');

// موسم جديد 2027 متاح فعلياً
r = rotateToNewSeason(window, 2027);
assert(r.rotated === true, 'rotated to 2027');
assert(r.window.current === 2027, 'new current 2027');
assert(r.window.previous === 2026, 'previous becomes 2026');
assert(r.purgeSeason === 2025, 'purge only 2025 after successful new season');

// بعد التدوير: نافذة تشغيلية لموسمين فقط
window = r.window;
assert(
  window.current === 2027 && window.previous === 2026,
  'final window only last two seasons'
);

if (process.exitCode) {
  console.error('Season window tests failed');
  process.exit(1);
}
console.log('All season-window tests passed');

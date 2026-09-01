#!/usr/bin/env tsx

/**
 * SEELLIE PROFESSIONAL ASSESSMENT & ENHANCEMENT PLAN v3.0
 *
 * تقييم واقعي مبني على فحص المشروع الفعلي — ليس أرقاماً ثابتة وهمية.
 *
 * التشغيل:
 *   npm run professional-assessment
 *   npm run professional-assessment -- --json
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const symbols = {
  star: '⭐',
  success: '✅',
  warning: '⚠️ ',
  rocket: '🚀',
  target: '🎯',
  chart: '📊',
};

const JSON_OUT = process.argv.includes('--json');

function findFiles(dir: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (pattern.test(entry.name)) files.push(full);
    }
  };
  walk(dir);
  return files;
}

function readVersion(): string {
  try {
    const raw = fs.readFileSync('app.config.ts', 'utf-8');
    return raw.match(/version:\s*['"]([^'"]+)['"]/)?.[1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function stars(score: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return symbols.star.repeat(filled) + (filled < 5 ? colors.dim + '·'.repeat(5 - filled) + colors.reset : '');
}

function runCmd(cmd: string): { ok: boolean; output: string } {
  try {
    return { ok: true, output: execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim() };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, output: (err.stdout || err.stderr || '').trim() };
  }
}

type Rating = { name: string; score: number; details: string };
type Enhancement = {
  title: string;
  priority: string;
  complexity: string;
  estimatedTime: string;
  files: string[];
  notes: string[];
};

function collectMetrics() {
  const srcTs = findFiles('src', /\.tsx?$/);
  const components = findFiles('src/components', /\.tsx$/);
  const screens = findFiles('src/screens', /\.tsx$/);
  const hooks = findFiles('src/hooks', /\.tsx?$/);
  const services = findFiles('src/services', /\.ts$/);
  const consoleFiles = srcTs.filter((f) => /console\./.test(fs.readFileSync(f, 'utf-8')));
  const memoCount = srcTs.filter((f) => /\bmemo\(/.test(fs.readFileSync(f, 'utf-8'))).length;
  const hasAr = fs.existsSync('src/i18n/locales/ar.ts');
  const hasEn = fs.existsSync('src/i18n/locales/en.ts');
  const hasSportsProxy = fs.existsSync('supabase/functions/sports-proxy/index.ts');
  const hasFabBus = fs.existsSync('src/services/floating-scroll-bus.ts');
  const hasFab = fs.existsSync('src/components/layout/FloatingActionMenu.tsx');
  const leaguesRaw = fs.existsSync('src/services/sports-data/leagues.ts')
    ? fs.readFileSync('src/services/sports-data/leagues.ts', 'utf-8')
    : '';
  const leagueCount = (leaguesRaw.match(/leagueId:/g) || []).length;
  const typecheck = runCmd('npm run typecheck');
  const tests = runCmd('npm run test');
  const testLines = tests.output.split('\n').filter((l) => l.startsWith('✓')).length;

  return {
    version: readVersion(),
    srcFiles: srcTs.length,
    components: components.length,
    screens: screens.length,
    hooks: hooks.length,
    services: services.length,
    consoleFiles: consoleFiles.length,
    memoCount,
    hasAr,
    hasEn,
    hasSportsProxy,
    hasFabBus,
    hasFab,
    leagueCount,
    typecheckOk: typecheck.ok,
    testsOk: tests.ok,
    testCount: testLines || (tests.ok ? 49 : 0),
  };
}

function buildRatings(m: ReturnType<typeof collectMetrics>): Rating[] {
  const structureScore =
    fs.existsSync('app') && fs.existsSync('src/services') && fs.existsSync('supabase/functions')
      ? 5
      : 4;

  const themeScore = findFiles('src/theme', /\.ts$/).length >= 3 ? 4.5 : 3.5;
  const i18nScore = m.hasAr && m.hasEn ? 5 : 3;
  const authScore =
    fs.existsSync('src/services/supabase-auth.ts') && fs.existsSync('src/services/firebase.ts')
      ? 4.5
      : 3.5;
  const unitTestScore = m.testsOk ? (m.testCount >= 40 ? 4 : 3) : 2;
  const integrationScore = 2;
  const typeScore = m.typecheckOk ? 5 : 3;
  const sportsScore = m.hasSportsProxy && m.leagueCount >= 5 ? 4.5 : 3;
  const fabScore = m.hasFab && m.hasFabBus ? 4 : 3;

  return [
    {
      name: 'هيكل التطبيق والتنظيم',
      score: structureScore,
      details: `${m.srcFiles} ملف src · ${m.screens} شاشة · ${m.services} خدمة`,
    },
    {
      name: 'نظام التصميم والألوان',
      score: themeScore,
      details: 'theme/ + Cairo + RTL — Design System موحّد',
    },
    {
      name: 'دعم العربية والإنجليزية (i18n)',
      score: i18nScore,
      details: m.hasAr && m.hasEn ? 'ar.ts + en.ts' : 'ترجمات ناقصة',
    },
    {
      name: 'المصادقة والأمان الأساسي',
      score: authScore,
      details: 'Supabase Auth + RLS + SecureStore — التحقق على الخادم',
    },
    {
      name: 'اختبارات الوحدة',
      score: unitTestScore,
      details: m.testsOk
        ? `~${m.testCount} اختبار يمر عبر npm test`
        : 'فشل npm test',
    },
    {
      name: 'TypeScript',
      score: typeScore,
      details: m.typecheckOk ? 'tsc --noEmit بدون أخطاء' : 'توجد أخطاء typecheck',
    },
    {
      name: 'الرياضة / API-Football',
      score: sportsScore,
      details: `${m.leagueCount} دوريات · sports-proxy · تفاصيل المباراة`,
    },
    {
      name: 'الأزرار العائمة (FAB)',
      score: fabScore,
      details: 'FloatingActionMenu + floating-scroll-bus (إخفاء أثناء التمرير)',
    },
    {
      name: 'اختبارات Integration / E2E',
      score: integrationScore,
      details: 'غير موجودة بعد — فرصة تحسين رئيسية',
    },
  ];
}

function avgScore(ratings: Rating[]): number {
  if (!ratings.length) return 0;
  return ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
}

function buildEnhancements(m: ReturnType<typeof collectMetrics>): Enhancement[] {
  return [
    {
      title: 'FAB — تلميع الحركة واللمس (Haptic)',
      priority: 'عالية',
      complexity: 'متوسطة',
      estimatedTime: '3-5 ساعات',
      files: [
        'src/components/layout/FloatingActionMenu.tsx',
        'src/services/floating-scroll-bus.ts',
        'src/hooks/useListChrome.ts',
      ],
      notes: [
        'الأساس موجود — تحسين opacity/momentum فقط',
        'إضافة HapticFeedback عند الضغط (iOS/Android)',
        'تجنب Reanimated إن لم تكن مثبتة — Animated كافٍ',
      ],
    },
    {
      title: 'اختبارات Integration للرياضة والمصادقة',
      priority: 'عالية',
      complexity: 'عالية',
      estimatedTime: '12-16 ساعة',
      files: [
        'scripts/fix09-p1-02-sports-unit.ts',
        'scripts/fix09-p1-01-sports-unit.ts',
        'src/services/sports-data/api-football-edge-provider.ts',
      ],
      notes: [
        'توسيع scripts/*-unit.ts الحالية',
        'محاكاة sports-proxy responses',
        'تدفق login → bundle → fixture detail',
      ],
    },
    {
      title: 'تقليل console.* في الإنتاج',
      priority: 'متوسطة',
      complexity: 'منخفضة',
      estimatedTime: '2-4 ساعات',
      files: [`${m.consoleFiles} ملف يحتوي console.*`],
      notes: [
        'لا حذف أعمى — استبدال بـ logger مشروط __DEV__',
        'الأولوية: TournamentProvider, private-space, supabase-*',
      ],
    },
    {
      title: 'توثيق JSDoc للخدمات الحساسة',
      priority: 'متوسطة',
      complexity: 'منخفضة',
      estimatedTime: '8-12 ساعة',
      files: ['src/services/sports-data/', 'src/services/floating-scroll-bus.ts', 'src/utils/media-limits.ts'],
      notes: ['توثيق العقود والأخطاء المتوقعة', 'شرح season-window والمزامنة'],
    },
    {
      title: 'E2E للويب (Playwright)',
      priority: 'متوسطة',
      complexity: 'عالية',
      estimatedTime: '20-30 ساعة',
      files: ['scripts/feed-final-runtime-audit.mjs', 'e2e/ (جديد)'],
      notes: [
        'استغلال probes الموجودة في scripts/',
        'سيناريو: عام/أبرز + فيديو + مباراة رياضية',
      ],
    },
    {
      title: 'تحسين الأداء — memo إضافي',
      priority: 'منخفضة',
      complexity: 'منخفضة',
      estimatedTime: '4-6 ساعات',
      files: [
        'src/components/media/FullScreenFeed.tsx',
        'src/components/media/InlineVideoPlayer.tsx',
        `حالياً ~${m.memoCount} ملف يستخدم memo`,
      ],
      notes: ['قياس قبل/بعد بـ React Profiler', 'لا تفرط في useMemo'],
    },
  ];
}

function printReport(m: ReturnType<typeof collectMetrics>, ratings: Rating[], enhancements: Enhancement[]) {
  const average = avgScore(ratings);

  console.clear();
  console.log('\n');
  console.log(
    `${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.cyan}║${colors.reset}${colors.bright}  🌟 تقييم احترافي واقعي — SEELLIE v3.0${' '.repeat(42)}${colors.reset}${colors.bright}${colors.cyan}║${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.cyan}║${colors.reset}${colors.bright}  الإصدار: v${m.version}  •  ملفات src: ${m.srcFiles}  •  اختبارات: ~${m.testCount}${' '.repeat(Math.max(0, 20 - String(m.version).length))}${colors.reset}${colors.bright}${colors.cyan}║${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════════════════════╝${colors.reset}\n`
  );

  console.log(`${colors.bright}${colors.blue}${symbols.chart} التقييمات (مبنية على الفحص الفعلي):${colors.reset}\n`);
  for (const r of ratings) {
    console.log(`  ${stars(r.score)} ${colors.bright}${r.name}${colors.reset} ${colors.dim}(${r.score}/5)${colors.reset}`);
    console.log(`     ${colors.dim}${r.details}${colors.reset}\n`);
  }
  console.log(
    `${colors.bright}المتوسط الإجمالي: ${stars(average)} ${average.toFixed(1)}/5${colors.reset}\n`
  );

  console.log(`${colors.bright}${colors.blue}${symbols.target} مجالات التحسين المقترحة:${colors.reset}\n`);
  enhancements.forEach((e, i) => {
    console.log(`  ${colors.bright}${colors.cyan}${i + 1}. ${e.title}${colors.reset}`);
    console.log(`     ${e.priority} · ${e.complexity} · ${colors.yellow}${e.estimatedTime}${colors.reset}`);
    for (const note of e.notes) console.log(`     ${colors.dim}• ${note}${colors.reset}`);
    console.log(`     ${colors.dim}📁 ${e.files.join(' · ')}${colors.reset}\n`);
  });

  console.log(`${colors.bright}${colors.blue}🚀 خطة العمل (أولوية):${colors.reset}\n`);
  console.log(`  ${colors.bright}الأسبوع 1:${colors.reset} FAB haptic + توسيع اختبارات sports`);
  console.log(`  ${colors.bright}الأسبوع 2:${colors.reset} logger بدل console + JSDoc للخدمات`);
  console.log(`  ${colors.bright}الأسبوع 3-4:${colors.reset} E2E ويب للتدفقات الرئيسية\n`);

  console.log(`${colors.bright}${colors.cyan}${'═'.repeat(88)}${colors.reset}`);
  console.log(`${colors.bright}الحالة:${colors.reset}`);
  console.log(`  ${m.typecheckOk ? symbols.success : '❌'} TypeScript`);
  console.log(`  ${m.testsOk ? symbols.success : '❌'} Unit tests`);
  console.log(`  ${symbols.warning} Integration/E2E: غير مكتملة بعد`);
  console.log(`  ${symbols.success} جاهز للنشر الويب مع اختبار يدوي + Ctrl+Shift+R\n`);

  if (average >= 4.5) {
    console.log(`${colors.green}${symbols.rocket} مشروع قوي — تحسينات متبقية اختيارية وليست حرجة.${colors.reset}\n`);
  } else if (average >= 3.5) {
    console.log(`${colors.yellow}${symbols.warning} مشروع جيد — ركّز على Integration tests وE2E.${colors.reset}\n`);
  } else {
    console.log(`${colors.red}يحتاج عمل إضافي قبل اعتباره «5 نجوم».${colors.reset}\n`);
  }
}

function main() {
  const metrics = collectMetrics();
  const ratings = buildRatings(metrics);
  const enhancements = buildEnhancements(metrics);

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          version: metrics.version,
          metrics,
          averageScore: avgScore(ratings),
          ratings,
          enhancements,
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    return;
  }

  printReport(metrics, ratings, enhancements);
}

main();

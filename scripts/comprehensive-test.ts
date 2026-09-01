#!/usr/bin/env tsx

/**
 * SEELLIE COMPREHENSIVE TEST SUITE v2.0
 *
 * فحص شامل واحترافي بدقة متناهية الدقة
 *
 * التشغيل:
 *   npm run comprehensive-test
 *   npm run comprehensive-test -- --verbose
 *   npm run comprehensive-test -- --fail-fast
 *   npm run comprehensive-test -- --skip-build
 *   npm run comprehensive-test -- --verbose --fail-fast --skip-build
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
  success: '✅',
  error: '❌',
  warning: '⚠️ ',
  info: 'ℹ️ ',
  clock: '⏱️ ',
  folder: '📁',
  rocket: '🚀',
  shield: '🛡️',
  cross: '✗',
  arrow: '➜',
  clipboard: '📋',
};

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'warn';
  duration: number;
  error?: string;
  details?: string;
  category?: string;
}

interface TestCategory {
  name: string;
  description: string;
  tests: TestResult[];
}

class SeellieComprehensiveTester {
  private categories: TestCategory[] = [];
  private currentCategory: TestCategory | null = null;
  private startTime = Date.now();
  private appVersion = '1.0.0';

  private options = {
    verbose: process.argv.includes('--verbose'),
    failFast: process.argv.includes('--fail-fast'),
    skipBuild: process.argv.includes('--skip-build'),
  };

  private hasFailures = false;
  private testStats = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    skipped: 0,
  };

  constructor() {
    this.readAppVersion();
  }

  private readAppVersion(): void {
    try {
      if (fs.existsSync('app.config.ts')) {
        const content = fs.readFileSync('app.config.ts', 'utf-8');
        const versionMatch = content.match(/version\s*:\s*['"]([\d.]+)['"]/);
        if (versionMatch) this.appVersion = versionMatch[1];
      }
    } catch {
      // default version
    }
  }

  printHeader(): void {
    console.clear();
    console.log('\n');
    console.log(
      `${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`
    );
    console.log(
      `${colors.bright}${colors.cyan}║${colors.reset}${colors.bright}  🧪 فحص تطبيق SEELLIE الشامل v2.0 ${symbols.rocket}${' '.repeat(38)}${colors.reset}${colors.bright}${colors.cyan}║${colors.reset}`
    );
    console.log(
      `${colors.bright}${colors.cyan}║${colors.reset}${colors.bright}  الإصدار: v${this.appVersion}  •  Expo / React Native  •  TypeScript${' '.repeat(Math.max(0, 24 - this.appVersion.length))}${colors.reset}${colors.bright}${colors.cyan}║${colors.reset}`
    );
    const flags = [
      this.options.verbose ? '📝 تفاصيل' : '',
      this.options.failFast ? '⚡ توقف سريع' : '',
      this.options.skipBuild ? '⏭️ تخطي البناء' : '',
    ]
      .filter(Boolean)
      .join(' | ');
    if (flags) {
      console.log(
        `${colors.bright}${colors.cyan}║${colors.reset}${colors.bright}  ${flags}${' '.repeat(Math.max(0, 76 - flags.length))}${colors.reset}${colors.bright}${colors.cyan}║${colors.reset}`
      );
    }
    console.log(
      `${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════════════════════╝${colors.reset}\n`
    );
  }

  startCategory(name: string, description: string): void {
    this.currentCategory = { name, description, tests: [] };
    this.categories.push(this.currentCategory);
    console.log(`\n${colors.bright}${colors.blue}${symbols.folder} ${name}${colors.reset}`);
    console.log(`${colors.dim}${symbols.arrow} ${description}${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(88)}${colors.reset}`);
  }

  addTest(
    name: string,
    status: 'pass' | 'fail' | 'skip' | 'warn',
    duration = 0,
    error?: string,
    details?: string
  ): void {
    if (!this.currentCategory) return;

    this.currentCategory.tests.push({
      name,
      status,
      duration,
      error,
      details,
      category: this.currentCategory.name,
    });

    this.testStats.total++;
    if (status === 'pass') this.testStats.passed++;
    else if (status === 'fail') this.testStats.failed++;
    else if (status === 'warn') this.testStats.warnings++;
    else if (status === 'skip') this.testStats.skipped++;

    const statusIcon =
      status === 'pass'
        ? `${colors.green}${symbols.success}${colors.reset}`
        : status === 'fail'
          ? `${colors.red}${symbols.error}${colors.reset}`
          : status === 'warn'
            ? `${colors.yellow}${symbols.warning}${colors.reset}`
            : `${colors.blue}${symbols.info}${colors.reset}`;

    const durationStr =
      duration > 0 ? `${colors.dim}[${duration}ms]${colors.reset}` : '';

    console.log(`  ${statusIcon} ${colors.bright}${name}${colors.reset} ${durationStr}`);

    if (error && this.options.verbose) {
      console.log(`     ${colors.red}${symbols.cross} ${error}${colors.reset}`);
    }
    if (details && this.options.verbose) {
      console.log(`     ${colors.dim}${details}${colors.reset}`);
    }

    if (status === 'fail') {
      this.hasFailures = true;
      if (this.options.failFast) {
        throw new Error(`Test failed: ${name}\n${error}`);
      }
    }
  }

  private exec(command: string, silent = false): string {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    }).trim();
  }

  private execTest(name: string, command: string, critical = true): boolean {
    const startTime = Date.now();
    try {
      this.exec(command, true);
      this.addTest(name, 'pass', Date.now() - startTime);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.addTest(
        name,
        critical ? 'fail' : 'warn',
        Date.now() - startTime,
        errorMsg.split('\n')[0].substring(0, 120)
      );
      return false;
    }
  }

  private findFiles(dir: string, pattern: RegExp): string[] {
    if (!fs.existsSync(dir)) return [];
    const files: string[] = [];
    const traverse = (currentDir: string) => {
      try {
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
          if (entry.name.startsWith('.')) continue;
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) traverse(fullPath);
          else if (pattern.test(entry.name)) files.push(fullPath);
        }
      } catch {
        // ignore
      }
    };
    traverse(dir);
    return files;
  }

  private fileHasAnyPattern(filePath: string, patterns: RegExp[]): boolean {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return patterns.some((p) => p.test(content));
    } catch {
      return false;
    }
  }

  private testEnvironment(): void {
    this.startCategory('1️⃣  فحص البيئة والإعدادات', 'التحقق من البيئة والملفات الأساسية');

    try {
      this.addTest('✓ Node.js متثبت', 'pass', 0, undefined, this.exec('node --version', true));
    } catch {
      this.addTest('✓ Node.js متثبت', 'fail', 0, 'Node.js غير متثبت');
    }

    try {
      this.addTest('✓ npm متثبت', 'pass', 0, undefined, this.exec('npm --version', true));
    } catch {
      this.addTest('✓ npm متثبت', 'fail', 0, 'npm غير متثبت');
    }

    for (const file of ['package.json', 'tsconfig.json', '.env.example', 'README.md', 'app.config.ts']) {
      this.addTest(`✓ ملف ${file} موجود`, fs.existsSync(file) ? 'pass' : 'fail');
    }

    for (const dir of [
      'src',
      'src/components',
      'src/screens',
      'src/services',
      'src/providers',
      'src/hooks',
      'src/utils',
      'src/theme',
      'src/types',
      'app',
      'app/(auth)',
      'app/(follower)',
      'scripts',
      'supabase/functions',
    ]) {
      this.addTest(`✓ مجلد ${dir} موجود`, fs.existsSync(dir) ? 'pass' : 'fail');
    }

    this.addTest(
      '✓ ملف .env معرّف',
      fs.existsSync('.env') ? 'pass' : 'warn',
      0,
      undefined,
      fs.existsSync('.env') ? 'تم إيجاد ملف .env' : 'استخدم .env.example'
    );
  }

  private testDependencies(): void {
    this.startCategory('2️⃣  فحص التبعيات والحزم', 'التحقق من التبعيات والأمان');

    const hasNodeModules = fs.existsSync('node_modules');
    this.addTest(
      '✓ مجلد node_modules موجود',
      hasNodeModules ? 'pass' : 'warn',
      0,
      undefined,
      hasNodeModules ? 'جاهز للتشغيل' : 'يحتاج npm install'
    );

    if (!hasNodeModules) {
      this.execTest('✓ تثبيت التبعيات (npm install)', 'npm install', true);
    }

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    for (const dep of [
      'expo',
      'react',
      'react-native',
      'react-native-web',
      'typescript',
      'expo-router',
      '@supabase/supabase-js',
      'firebase',
    ]) {
      const version =
        packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
      this.addTest(
        `✓ حزمة ${dep}`,
        version ? 'pass' : 'fail',
        0,
        undefined,
        version ? `الإصدار: ${version}` : 'حزمة مفقودة'
      );
    }

    console.log(`\n  ${colors.dim}${symbols.shield} فحص الأمان...${colors.reset}`);
    try {
      this.exec('npm audit --production 2>&1', true);
      this.addTest('✓ فحص الأمان (npm audit)', 'pass', 0, undefined, 'لا توجد ثغرات حرجة');
    } catch {
      this.addTest('✓ فحص الأمان (npm audit)', 'warn', 0, undefined, 'قد توجد تحديثات أمنية');
    }
  }

  private testTypeScript(): void {
    this.startCategory('3️⃣  فحص أنواع TypeScript', 'التحقق من سلامة الأنواع');

    this.execTest('✓ فحص TypeScript الشامل', 'npm run typecheck', true);

    const tsFiles = this.findFiles('src', /\.tsx?$/);
    this.addTest(
      `✓ ملفات TypeScript: ${tsFiles.length}`,
      tsFiles.length > 0 ? 'pass' : 'warn',
      0,
      undefined,
      `${tsFiles.length} ملف`
    );
  }

  private testUnits(): void {
    this.startCategory('4️⃣  اختبارات الوحدة', 'فحص الدوال والخدمات الأساسية');
    this.execTest('✓ اختبارات الوحدة (Unit Tests)', 'npm run test', true);
  }

  private testBuilds(): void {
    this.startCategory('5️⃣  فحص البناء', 'فحص بناء الويب');

    if (this.options.skipBuild) {
      this.addTest('⏭️  تم تخطي بناء الويب', 'skip', 0, undefined, '--skip-build');
      return;
    }

    this.execTest('✓ بناء الويب (Web Build)', 'npm run build:web', false);

    const buildDir = fs.existsSync('dist') || fs.existsSync('web-build');
    this.addTest(
      '✓ مجلد البناء موجود',
      buildDir ? 'pass' : 'warn',
      0,
      undefined,
      buildDir ? 'dist أو web-build' : 'لم يُنشأ بعد'
    );
  }

  private testComponents(): void {
    this.startCategory('6️⃣  فحص المكونات', 'UI + فيديو + FAB');

    const allComponents = this.findFiles('src/components', /\.tsx$/);
    const uiComponents = this.findFiles('src/components/ui', /\.tsx$/);

    this.addTest(
      `✓ مكونات UI: ${uiComponents.length}`,
      uiComponents.length > 0 ? 'pass' : 'warn',
      0,
      undefined,
      `${uiComponents.length} مكون`
    );

    this.addTest(
      `✓ إجمالي المكونات: ${allComponents.length}`,
      allComponents.length > 0 ? 'pass' : 'warn'
    );

    const videoComponents = allComponents.filter((f) =>
      /Video|Feed|media/i.test(f)
    );
    this.addTest(
      `✓ مكونات الفيديو: ${videoComponents.length}`,
      videoComponents.length > 0 ? 'pass' : 'warn',
      0,
      undefined,
      'FullScreenFeed / InlineVideoPlayer'
    );

    for (const component of [
      'src/components/ui/Button.tsx',
      'src/components/ui/Text.tsx',
      'src/components/ui/Card.tsx',
      'src/components/layout/Screen.tsx',
      'src/components/layout/FloatingActionMenu.tsx',
      'src/components/media/FullScreenFeed.tsx',
      'src/components/media/InlineVideoPlayer.tsx',
    ]) {
      this.addTest(
        `✓ مكون ${path.basename(component, '.tsx')}`,
        fs.existsSync(component) ? 'pass' : 'warn'
      );
    }

    const themeSupport = allComponents.some((file) =>
      this.fileHasAnyPattern(file, [/useAppTheme/, /ThemeProvider/, /useColorScheme/])
    );
    this.addTest('✓ دعم الثيم / Dark Mode', themeSupport ? 'pass' : 'warn');

    const rtlSupport = this.findFiles('src', /\.tsx?$/).some((file) =>
      this.fileHasAnyPattern(file, [/isRTL/, /writingDirection/, /I18nManager/])
    );
    this.addTest('✓ دعم RTL (العربية)', rtlSupport ? 'pass' : 'warn');

    const safeAreaSupport = allComponents.some((file) =>
      this.fileHasAnyPattern(file, [/SafeArea/, /useSafeAreaInsets/])
    );
    this.addTest('✓ دعم SafeArea', safeAreaSupport ? 'pass' : 'warn');
  }

  private testScreens(): void {
    this.startCategory('7️⃣  فحص الشاشات', 'متابع · رياضة · مباراة');

    const expectedScreens = [
      { path: 'app/index.tsx', name: 'الصفحة الرئيسية', emoji: '🏠' },
      { path: 'app/(auth)/login.tsx', name: 'تسجيل الدخول', emoji: '🔐' },
      { path: 'app/(follower)/index.tsx', name: 'الرئيسية للمتابع', emoji: '👁️' },
      { path: 'app/(follower)/general.tsx', name: 'عام', emoji: '🌐' },
      { path: 'app/(follower)/highlights.tsx', name: 'أبرز', emoji: '⭐' },
      { path: 'app/(follower)/sports/fixtures/[id].tsx', name: 'تفاصيل المباراة', emoji: '⚽' },
      { path: 'app/(freelancer)', name: 'شاشات المستقل', emoji: '💼' },
      { path: 'app/(organizer)', name: 'شاشات المنظم', emoji: '🎯' },
      { path: 'app/admin', name: 'لوحة المشرف', emoji: '⚙️' },
      { path: 'app/profile/[id].tsx', name: 'ملف المستخدم', emoji: '👥' },
    ];

    let foundScreens = 0;
    for (const screen of expectedScreens) {
      const exists = fs.existsSync(screen.path);
      if (exists) foundScreens++;
      this.addTest(`✓ ${screen.emoji} ${screen.name}`, exists ? 'pass' : 'warn');
    }

    this.addTest(
      `✓ نسبة الشاشات: ${Math.round((foundScreens / expectedScreens.length) * 100)}%`,
      foundScreens >= expectedScreens.length - 1 ? 'pass' : 'warn'
    );

    const screenFiles = this.findFiles('src/screens', /\.tsx$/);
    this.addTest(`✓ ملفات الشاشات: ${screenFiles.length}`, screenFiles.length > 0 ? 'pass' : 'warn');

    const routingFiles = this.findFiles('app', /\.tsx$/);
    this.addTest(`✓ ملفات التوجيه: ${routingFiles.length}`, routingFiles.length > 0 ? 'pass' : 'warn');

    const hasSportScreen = routingFiles.some((f) => /sport|fixture/i.test(f));
    this.addTest('✓ شاشة الرياضة/المباراة', hasSportScreen ? 'pass' : 'warn');
  }

  private testServices(): void {
    this.startCategory('8️⃣  فحص الخدمات', 'Supabase + Sports + sports-proxy');

    const serviceFiles = this.findFiles('src/services', /\.ts$/);
    this.addTest(`✓ ملفات الخدمات: ${serviceFiles.length}`, serviceFiles.length > 0 ? 'pass' : 'warn');

    const expectedServices = [
      { name: 'Firebase', pattern: /firebase/ },
      { name: 'Supabase', pattern: /supabase/ },
      { name: 'Sports API', pattern: /sports-data/ },
      { name: 'AsyncStorage', pattern: /async-storage|AsyncStorage/ },
      { name: 'SecureStore', pattern: /secure-store|SecureStore/ },
      { name: 'Notifications', pattern: /notif/ },
    ];

    for (const service of expectedServices) {
      const found = serviceFiles.some((file) =>
        service.pattern.test(fs.readFileSync(file, 'utf-8'))
      );
      this.addTest(`✓ خدمة ${service.name}`, found ? 'pass' : 'warn');
    }

    this.addTest(
      '✓ Edge Function: sports-proxy',
      fs.existsSync('supabase/functions/sports-proxy/index.ts') ? 'pass' : 'fail'
    );

    const hookFiles = this.findFiles('src/hooks', /\.tsx?$/);
    const hasSportsHooks = hookFiles.some((f) =>
      /useSports|useNationalLeague|useFixture/i.test(f)
    );
    this.addTest(
      '✓ Hooks الرياضة',
      hasSportsHooks ? 'pass' : 'warn',
      0,
      undefined,
      'useSportsFixtureDetail / useNationalLeague'
    );

    const envExample = fs.readFileSync('.env.example', 'utf-8');
    for (const envVar of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) {
      this.addTest(`✓ متغير البيئة: ${envVar}`, envExample.includes(envVar) ? 'pass' : 'warn');
    }
  }

  private testTheme(): void {
    this.startCategory('9️⃣  فحص النمط والتصميم', 'الألوان والخطوط');

    const themeFiles = this.findFiles('src/theme', /\.(ts|tsx)$/);
    this.addTest(`✓ ملفات النمط: ${themeFiles.length}`, themeFiles.length > 0 ? 'pass' : 'warn');

    for (const element of ['colors', 'spacing', 'typography', 'radius', 'shadows']) {
      const found = themeFiles.some((file) =>
        fs.readFileSync(file, 'utf-8').includes(element)
      );
      this.addTest(`✓ عنصر: ${element}`, found ? 'pass' : 'warn');
    }

    const fontConfig = themeFiles.some((file) =>
      fs.readFileSync(file, 'utf-8').includes('Cairo')
    );
    this.addTest('✓ خطوط Cairo', fontConfig ? 'pass' : 'warn');
  }

  private testHooks(): void {
    this.startCategory('🔟 فحص Hooks المخصصة', 'التحقق من Hooks');

    const hookFiles = this.findFiles('src/hooks', /\.tsx?$/);
    this.addTest(`✓ ملفات Hooks: ${hookFiles.length}`, hookFiles.length > 0 ? 'pass' : 'warn');

    for (const hook of [
      'useResponsive',
      'useNationalLeague',
      'useSportsFixtureDetail',
      'useListChrome',
    ]) {
      const found = hookFiles.some((file) => path.basename(file).includes(hook));
      this.addTest(`✓ Hook: ${hook}`, found ? 'pass' : 'warn');
    }
  }

  private testI18n(): void {
    this.startCategory('1️⃣1️⃣ الدعم متعدد اللغات (i18n)', 'العربية والإنجليزية');

    this.addTest('✓ مجلد i18n موجود', fs.existsSync('src/i18n') ? 'pass' : 'warn');
    this.addTest('✓ ترجمة عربية (ar.ts)', fs.existsSync('src/i18n/locales/ar.ts') ? 'pass' : 'fail');
    this.addTest('✓ ترجمة إنجليزية (en.ts)', fs.existsSync('src/i18n/locales/en.ts') ? 'pass' : 'fail');

    const srcFiles = this.findFiles('src', /\.tsx?$/);
    const usingI18n = srcFiles.some((file) =>
      this.fileHasAnyPattern(file, [/useTranslation/, /i18n/])
    );
    this.addTest('✓ استخدام i18n في الملفات', usingI18n ? 'pass' : 'warn');
  }

  private testTypes(): void {
    this.startCategory('1️⃣2️⃣ الأنواع والواجهات (Types)', 'نظام الأنواع');

    const typeFiles = this.findFiles('src/types', /\.ts$/);
    this.addTest(`✓ ملفات الأنواع: ${typeFiles.length}`, typeFiles.length > 0 ? 'pass' : 'warn');

    for (const type of ['User', 'Competition', 'Match', 'Player']) {
      const found = typeFiles.some((file) =>
        new RegExp(`(type|interface)\\s+${type}\\b`).test(fs.readFileSync(file, 'utf-8'))
      );
      this.addTest(`✓ نوع: ${type}`, found ? 'pass' : 'warn');
    }
  }

  private testUtils(): void {
    this.startCategory('1️⃣3️⃣ الأدوات المساعدة (Utils)', 'دوال المساعدة');

    const utilFiles = this.findFiles('src/utils', /\.ts$/);
    this.addTest(`✓ ملفات الأدوات: ${utilFiles.length}`, utilFiles.length > 0 ? 'pass' : 'warn');
  }

  private testProviders(): void {
    this.startCategory('1️⃣4️⃣ المزودات (Providers)', 'Context Providers');

    const providerFiles = this.findFiles('src/providers', /\.tsx?$/);
    this.addTest(`✓ ملفات المزودات: ${providerFiles.length}`, providerFiles.length > 0 ? 'pass' : 'warn');

    for (const provider of ['Theme', 'Toast', 'Language', 'Tournament']) {
      const found = providerFiles.some((file) =>
        fs.readFileSync(file, 'utf-8').includes(provider)
      );
      this.addTest(`✓ مزود: ${provider}Provider`, found ? 'pass' : 'warn');
    }
  }

  private testData(): void {
    this.startCategory('1️⃣5️⃣ البيانات الأولية', 'البيانات والملفات');

    const dataFiles = this.findFiles('src/data', /\.ts$/);
    this.addTest(`✓ ملفات البيانات: ${dataFiles.length}`, dataFiles.length > 0 ? 'pass' : 'warn');
    this.addTest(
      '✓ initial-data.ts موجود',
      fs.existsSync('src/data/initial-data.ts') ? 'pass' : 'warn'
    );
  }

  private testSeellieSpecific(): void {
    this.startCategory('1️⃣6️⃣ تكييفات Seellie الخاصة', 'الميزات الفريدة للتطبيق');

    this.addTest(
      `✓ إصدار التطبيق: v${this.appVersion}`,
      'pass',
      0,
      undefined,
      `من app.config.ts`
    );

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    this.addTest(
      '✓ Expo Router متثبت',
      packageJson.dependencies?.['expo-router'] ? 'pass' : 'fail'
    );

    this.addTest('✓ مجلد src/components/ui', fs.existsSync('src/components/ui') ? 'pass' : 'warn');

    this.addTest(
      '✓ sports-proxy (Supabase Edge)',
      fs.existsSync('supabase/functions/sports-proxy/index.ts') ? 'pass' : 'fail'
    );

    this.addTest(
      '✓ شاشة SportsFixtureDetailScreen',
      fs.existsSync('src/screens/follower/SportsFixtureDetailScreen.tsx') ? 'pass' : 'warn'
    );

    this.addTest(
      '✓ الدوريات المتتبعة (leagues.ts)',
      fs.existsSync('src/services/sports-data/leagues.ts') ? 'pass' : 'warn'
    );

    const leaguesContent = fs.existsSync('src/services/sports-data/leagues.ts')
      ? fs.readFileSync('src/services/sports-data/leagues.ts', 'utf-8')
      : '';
    this.addTest(
      '✓ الدوري الأمريكي (MLS)',
      leaguesContent.includes('mls') || leaguesContent.includes('253') ? 'pass' : 'warn'
    );
    this.addTest(
      '✓ الدوري الألماني (Bundesliga)',
      leaguesContent.includes('bundesliga') || leaguesContent.includes('78') ? 'pass' : 'warn'
    );

    for (const role of ['app/(follower)', 'app/(freelancer)', 'app/(organizer)']) {
      this.addTest(`✓ شاشات ${role.replace(/[()]/g, '')}`, fs.existsSync(role) ? 'pass' : 'warn');
    }

    this.addTest(
      '✓ إخفاء sports من التبويب السفلي',
      fs.existsSync('app/(follower)/sports/_layout.tsx') &&
        this.fileHasAnyPattern('app/(follower)/_layout.tsx', [/name="sports"/, /href:\s*null/])
        ? 'pass'
        : 'warn'
    );
  }

  private printReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const successRate =
      this.testStats.total > 0
        ? Math.round((this.testStats.passed / this.testStats.total) * 100)
        : 0;

    console.log(`\n${colors.bright}${colors.cyan}${'═'.repeat(88)}${colors.reset}\n`);
    console.log(`${colors.bright}${colors.white}${symbols.clipboard} ملخص النتائج:${colors.reset}\n`);
    console.log(
      `  ${colors.bright}${colors.green}${symbols.success} نجح:${colors.reset} ${this.testStats.passed}/${this.testStats.total}`
    );
    if (this.testStats.failed > 0) {
      console.log(
        `  ${colors.bright}${colors.red}${symbols.error} فشل:${colors.reset} ${this.testStats.failed}/${this.testStats.total}`
      );
    }
    if (this.testStats.warnings > 0) {
      console.log(
        `  ${colors.bright}${colors.yellow}${symbols.warning} تحذيرات:${colors.reset} ${this.testStats.warnings}/${this.testStats.total}`
      );
    }
    if (this.testStats.skipped > 0) {
      console.log(
        `  ${colors.bright}${colors.blue}${symbols.info} تم تخطيه:${colors.reset} ${this.testStats.skipped}/${this.testStats.total}`
      );
    }

    console.log('');
    console.log(
      `  ${colors.bright}${colors.magenta}📊 نسبة النجاح:${colors.reset} ${colors.bright}${successRate}%${colors.reset}`
    );
    console.log(
      `  ${colors.bright}${colors.cyan}${symbols.clock} المدة الكلية:${colors.reset} ${colors.bright}${(totalDuration / 1000).toFixed(2)}s${colors.reset}`
    );
    console.log(`\n${colors.bright}${colors.cyan}${'═'.repeat(88)}${colors.reset}\n`);

    if (this.testStats.failed === 0 && this.testStats.warnings === 0) {
      console.log(
        `${colors.bright}${colors.green}${symbols.success} ${symbols.rocket} ممتاز! جميع الاختبارات نجحت!${colors.reset}`
      );
    } else if (this.testStats.failed === 0) {
      console.log(
        `${colors.bright}${colors.yellow}${symbols.warning} جيد جداً — توجد تحذيرات فقط.${colors.reset}`
      );
    } else {
      console.log(
        `${colors.bright}${colors.red}${symbols.error} توجد أخطاء تحتاج معالجة.${colors.reset}`
      );
    }

    console.log(`\n${colors.dim}انتهى الفحص: ${new Date().toLocaleString('ar-SA')}${colors.reset}\n`);
  }

  async runAll(): Promise<void> {
    this.printHeader();

    try {
      this.testEnvironment();
      this.testDependencies();
      this.testTypeScript();
      this.testUnits();
      this.testBuilds();
      this.testComponents();
      this.testScreens();
      this.testServices();
      this.testTheme();
      this.testHooks();
      this.testI18n();
      this.testTypes();
      this.testUtils();
      this.testProviders();
      this.testData();
      this.testSeellieSpecific();
      this.printReport();

      if (this.hasFailures) {
        console.log(`\n${colors.red}❌ انتهى الفحص بأخطاء.${colors.reset}\n`);
        process.exit(1);
      }

      console.log(`\n${colors.green}✅ انتهى الفحص بنجاح.${colors.reset}\n`);
      process.exit(0);
    } catch (error) {
      console.error(`\n${colors.red}${symbols.error} خطأ حرج:${colors.reset}`, error);
      process.exit(1);
    }
  }
}

const tester = new SeellieComprehensiveTester();
tester.runAll().catch(console.error);

/**
 * Runtime autoplay probe — Web Chrome headless (no synthetic clicks).
 * Native expo-av requires device/simulator; marked NOT_MEASURED.
 *
 * Usage: npm run build:web && node scripts/autoplay-full-runtime-probe.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
};

const WEB_VIEWPORTS = [
  { label: '390x844', width: 390, height: 844 },
  { label: '768x1024', width: 768, height: 1024 },
  { label: '1440x900', width: 1440, height: 900 },
];

const SEED_USER = {
  id: 'follower-1',
  name: 'متابع شغوف',
  email: 'follower@test.com',
  passwordHash: 'password123',
  role: 'follower',
  status: 'active',
  handle: '@follower',
  visibleId: 'FOL-1001',
  avatar: 'https://placehold.co/100x100.png',
  permissions: {
    canComment: true,
    canUseVoice: true,
    canCreateContent: false,
    canNominateToPersonality: false,
  },
  posts: [],
  media: { photos: [], videos: [] },
  personalityPhotos: [],
  comments: [],
  analysisContent: [],
};

function serveDist() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', BASE);
      let path = decodeURIComponent(url.pathname);
      if (path === '/' || !extname(path)) path = '/index.html';
      const file = join(DIST, path);
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
}

async function seedSession(page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      'tajjd.secure.currentUser',
      JSON.stringify(user)
    );
  }, SEED_USER);
}

async function waitForAppReady(page, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const loading = document.body?.innerText?.includes('Loading');
      const hasUser = !!window.localStorage.getItem('tajjd.secure.currentUser');
      const videos = document.querySelectorAll('video').length;
      const text = document.body?.innerText || '';
      return { loading, hasUser, videos, textLen: text.length };
    });
    if (!state.loading && state.hasUser && state.textLen > 80) return state;
    await page.waitForTimeout(400);
  }
  return { timedOut: true };
}

async function openScreen(page, screenPath) {
  const routes = [
    screenPath,
    screenPath.replace('/(follower)', ''),
    `/(follower)${screenPath.replace('/(follower)', '')}`,
  ];
  for (const route of [...new Set(routes)]) {
    await page.goto(`${BASE}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForAppReady(page);
    await page.waitForTimeout(1500);
    const videos = await page.evaluate(
      () => document.querySelectorAll('video').length
    );
    if (videos > 0) return { route, videos };
  }
  return { route: screenPath, videos: 0 };
}

async function scrollFeed(page, steps = 8) {
  const box = page.viewportSize();
  if (!box) return;
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, box.height * 0.85);
    await page.waitForTimeout(450);
    const found = await page.evaluate(() => {
      const v = Array.from(document.querySelectorAll('video')).find(
        (el) => el.src && el.src.startsWith('http')
      );
      return !!v;
    });
    if (found) return true;
  }
  return false;
}

async function readVideoState(page) {
  return page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    const v = videos.find((el) => el.src && el.src.startsWith('http'));
    if (!v) return { found: false, count: videos.length };
    return {
      found: true,
      count: videos.length,
      paused: v.paused,
      muted: v.muted,
      volume: v.volume,
      currentTime: v.currentTime,
      readyState: v.readyState,
      videoWidth: v.videoWidth,
    };
  });
}

async function waitForPlayingVideo(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readVideoState(page);
    if (state.found && !state.paused && state.currentTime > 0) {
      return { ...state, ms: Date.now() - start, timedOut: false };
    }
    await page.waitForTimeout(300);
  }
  const last = await readVideoState(page);
  return { ...last, timedOut: true };
}

async function probeWebScreen(browser, screenKey, screenPath) {
  const out = {};
  for (const vp of WEB_VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();
    await seedSession(page);
    try {
      const opened = await openScreen(page, screenPath);
      if (opened.videos === 0) await scrollFeed(page);
      const video = await waitForPlayingVideo(page);
      const pass =
        video.found &&
        !video.timedOut &&
        video.paused === false &&
        video.currentTime > 0;
      out[vp.label] = pass ? 'PASS' : 'FAIL';
      out[`${vp.label}_detail`] = { opened, video };
      if (pass) {
        out[`${vp.label}_audio`] = video.muted
          ? 'VIDEO_PLAYING_MUTED'
          : 'VIDEO_PLAYING_UNMUTED';
      }
    } catch (error) {
      out[vp.label] = 'FAIL';
      out[`${vp.label}_detail`] = String(error);
    } finally {
      await context.close();
    }
  }
  return { [`WEB_${screenKey}`]: out };
}

async function probeTransition(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await seedSession(page);
  try {
    await openScreen(page, '/general');
    if ((await readVideoState(page)).count === 0) await scrollFeed(page);
    const a = await waitForPlayingVideo(page, 15000);
    const box = page.viewportSize();
    if (box) await page.mouse.wheel(0, box.height * 0.95);
    await page.waitForTimeout(900);
    const b = await waitForPlayingVideo(page, 15000);
    const videos = await page.evaluate(() =>
      Array.from(document.querySelectorAll('video')).map((v) => ({
        paused: v.paused,
        currentTime: v.currentTime,
      }))
    );
    const playingCount = videos.filter(
      (v) => !v.paused && v.currentTime > 0
    ).length;
    return {
      WEB_SINGLE_ACTIVE_VIDEO:
        a.found && b.found && playingCount <= 1 ? 'PASS' : 'FAIL',
      WEB_TRANSITION_DETAIL: { a, b, playingCount, videos },
    };
  } catch (error) {
    return {
      WEB_SINGLE_ACTIVE_VIDEO: 'FAIL',
      WEB_TRANSITION_DETAIL: String(error),
    };
  } finally {
    await context.close();
  }
}

async function probeMobileUA(browser, screenKey, screenPath) {
  const out = {};
  for (const [label, device] of [
    ['IPHONE_UA', devices['iPhone 13']],
    ['ANDROID_UA', devices['Pixel 5']],
  ]) {
    const context = await browser.newContext({ ...device });
    const page = await context.newPage();
    await seedSession(page);
    try {
      const opened = await openScreen(page, screenPath);
      if (opened.videos === 0) await scrollFeed(page);
      const video = await waitForPlayingVideo(page);
      const pass =
        video.found &&
        !video.timedOut &&
        !video.paused &&
        video.currentTime > 0;
      out[`${screenKey}_${label}`] = pass ? 'PASS' : 'FAIL';
      out[`${screenKey}_${label}_detail`] = { opened, video };
    } catch (error) {
      out[`${screenKey}_${label}`] = 'FAIL';
      out[`${screenKey}_${label}_detail`] = String(error);
    } finally {
      await context.close();
    }
  }
  return out;
}

const report = {
  NATIVE_IOS_EXPO_AV:
    'NOT_MEASURED — no iOS Simulator/device with expo-av in this environment',
  NATIVE_ANDROID_EXPO_AV:
    'NOT_MEASURED — no Android Emulator/device with expo-av in this environment',
  NOTE: 'Web probes use static export + localStorage seed; mobile UA ≠ native expo-av.',
};

const server = serveDist();
await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

Object.assign(report, await probeTransition(browser));
Object.assign(report, await probeWebScreen(browser, 'GENERAL', '/general'));
Object.assign(report, await probeWebScreen(browser, 'HIGHLIGHTS', '/highlights'));
Object.assign(report, await probeMobileUA(browser, 'GENERAL', '/general'));
Object.assign(report, await probeMobileUA(browser, 'HIGHLIGHTS', '/highlights'));

await browser.close();
server.close();

console.log(JSON.stringify(report, null, 2));

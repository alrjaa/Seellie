/**
 * Feed autoplay + FAB stability runtime probe (Chrome headless).
 * Usage: npm run build:web && node scripts/feed-audit-runtime-probe.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = 4175;
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

const VIEWPORTS = [
  { label: '390', width: 390, height: 844 },
  { label: '768', width: 768, height: 1024 },
  { label: '1440', width: 1440, height: 900 },
];

const SEED_USER = {
  id: 'follower-1',
  name: 'متابع',
  email: 'follower@test.com',
  passwordHash: 'password123',
  role: 'follower',
  status: 'active',
  handle: '@follower',
  visibleId: 'FOL-1001',
  avatar: 'https://placehold.co/100x100.png',
  permissions: {
    canComment: true,
    canCreateContent: false,
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

async function waitForApp(page, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await page.evaluate(() => {
      const loading = document.body?.innerText?.includes('Loading');
      const hasUser = !!window.localStorage.getItem('tajjd.secure.currentUser');
      return !loading && hasUser && (document.body?.innerText?.length || 0) > 80;
    });
    if (ok) return true;
    await page.waitForTimeout(350);
  }
  return false;
}

async function openRoute(page, route) {
  await page.goto(`${BASE}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await waitForApp(page);
  await page.waitForTimeout(1200);
}

async function scrollSteps(page, steps = 6) {
  const box = page.viewportSize();
  if (!box) return;
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, box.height * 0.9);
    await page.waitForTimeout(500);
  }
}

async function videoSnapshot(page) {
  return page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    const playing = videos.filter((v) => !v.paused && v.currentTime > 0);
    const active = playing[0] || videos.find((v) => v.src?.startsWith('http'));
    return {
      total: videos.length,
      playingCount: playing.length,
      active: active
        ? {
            paused: active.paused,
            muted: active.muted,
            volume: active.volume,
            currentTime: active.currentTime,
            readyState: active.readyState,
            src: active.src?.slice(0, 80),
          }
        : null,
    };
  });
}

async function waitForActiveVideo(page, timeoutMs = 18000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await videoSnapshot(page);
    if (snap.active && !snap.active.paused && snap.active.currentTime > 0) {
      return { ...snap, timedOut: false };
    }
    await page.waitForTimeout(300);
  }
  return { ...(await videoSnapshot(page)), timedOut: true };
}

async function fabSnapshot(page) {
  return page.evaluate(() => {
    const fab = document.querySelector('[data-seellie-fab="1"]');
    if (!fab) return { found: false };
    const wrap = fab.querySelector('[style*="position"]') || fab.firstElementChild;
    const el = wrap || fab;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      found: true,
      left: Math.round(rect.left),
      bottom: Math.round(window.innerHeight - rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      opacity: style.opacity,
      transform: style.transform,
    };
  });
}

async function probeScreen(browser, route, screenName) {
  const results = {};
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await ctx.newPage();
    await seedSession(page);
    const key = `${screenName}_${vp.label}`;
    try {
      await openRoute(page, route);
      let snap = await videoSnapshot(page);
      if (!snap.active) {
        await scrollSteps(page);
        snap = await waitForActiveVideo(page);
      } else {
        snap = await waitForActiveVideo(page);
      }

      const fabBefore = await fabSnapshot(page);
      await page.waitForTimeout(800);
      const fabAfter = await fabSnapshot(page);

      const fabStable =
        fabBefore.found &&
        fabAfter.found &&
        Math.abs((fabBefore.left || 0) - (fabAfter.left || 0)) <= 2 &&
        Math.abs((fabBefore.bottom || 0) - (fabAfter.bottom || 0)) <= 2;

      results[`${key}_VIDEO_AUTOPLAY`] =
        snap.active && !snap.active.paused && snap.active.currentTime > 0
          ? 'PASS'
          : snap.timedOut
            ? 'FAIL_NO_VIDEO'
            : 'FAIL';
      results[`${key}_AUDIO`] = !snap.active
        ? 'NOT_MEASURED'
        : snap.active.muted
          ? 'MUTED_PLAYING'
          : 'UNMUTED_PLAYING';
      results[`${key}_SINGLE_ACTIVE`] =
        snap.playingCount <= 1 ? 'PASS' : `FAIL_${snap.playingCount}_PLAYING`;
      results[`${key}_FAB_STABLE`] = fabStable ? 'PASS' : 'FAIL';
      results[`${key}_detail`] = { snap, fabBefore, fabAfter };
    } catch (error) {
      results[`${key}_VIDEO_AUTOPLAY`] = 'FAIL';
      results[`${key}_detail`] = String(error);
    } finally {
      await ctx.close();
    }
  }
  return results;
}

async function probeTransitions(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await seedSession(page);
  try {
    await openRoute(page, '/general');
    let a = await waitForActiveVideo(page);
    if (!a.active) {
      await scrollSteps(page, 2);
      a = await waitForActiveVideo(page);
    }
    const box = page.viewportSize();
    if (box) await page.mouse.wheel(0, box.height * 0.95);
    await page.waitForTimeout(900);
    const b = await waitForActiveVideo(page);
    const leave = await videoSnapshot(page);
    if (box) await page.mouse.wheel(0, -box.height * 0.95);
    await page.waitForTimeout(900);
    const back = await waitForActiveVideo(page, 12000);

    return {
      TRANSITION_A_TO_B: b.active && !b.active.paused ? 'PASS' : 'FAIL',
      TRANSITION_SINGLE_ACTIVE: leave.playingCount <= 1 ? 'PASS' : 'FAIL',
      TRANSITION_RESUME: back.active && !back.active.paused ? 'PASS' : 'FAIL',
      TRANSITION_detail: { a, b, leave, back },
    };
  } catch (error) {
    return {
      TRANSITION_A_TO_B: 'FAIL',
      TRANSITION_detail: String(error),
    };
  } finally {
    await ctx.close();
  }
}

const report = {
  NATIVE_IOS: 'NOT_MEASURED — no iOS Simulator/device in this environment',
  NATIVE_ANDROID: 'NOT_MEASURED — no Android Emulator/device in this environment',
  CHROME_FLAGS: '--autoplay-policy=no-user-gesture-required',
};

const server = serveDist();
await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

Object.assign(report, await probeTransitions(browser));
Object.assign(report, await probeScreen(browser, '/general', 'GENERAL'));
Object.assign(report, await probeScreen(browser, '/highlights', 'HIGHLIGHTS'));

await browser.close();
server.close();

console.log(JSON.stringify(report, null, 2));

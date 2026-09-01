/**
 * Runtime autoplay probe — Chrome headless, no synthetic video clicks.
 * Usage: node scripts/autoplay-runtime-probe.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = 4173;
const VIEWPORTS = [
  { label: '390', width: 390, height: 844 },
  { label: '768', width: 768, height: 1024 },
  { label: '1440', width: 1440, height: 900 },
];

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

function serveDist() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let path = decodeURIComponent(url.pathname);
      if (path === '/' || !extname(path)) {
        path = '/index.html';
      }
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

async function seedSession(page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      'tajjd.secure.currentUser',
      JSON.stringify(user)
    );
  }, SEED_USER);
}

async function loginFollower(page) {
  await seedSession(page);
}

async function openFeed(page, screenPath) {
  const paths = [screenPath, `/(follower)${screenPath}`];
  for (const p of paths) {
    await page.goto(`http://127.0.0.1:${PORT}${p}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    await page.waitForTimeout(1500);
    const hasFeed = await page.evaluate(() => {
      return !!document.querySelector('video, [data-testid], .rn-flatlist');
    });
    if (hasFeed) return;
  }
}

async function scrollToFirstVideo(page, maxSwipes = 12) {
  for (let i = 0; i < maxSwipes; i += 1) {
    const state = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      const v = videos.find((el) => el.src && el.src.startsWith('http'));
      if (v) {
        return {
          found: true,
          paused: v.paused,
          muted: v.muted,
          currentTime: v.currentTime,
          readyState: v.readyState,
        };
      }
      return { found: false };
    });
    if (state.found) return state;
    const box = page.viewportSize();
    if (box) {
      await page.mouse.wheel(0, box.height * 0.9);
    }
    await page.waitForTimeout(500);
  }
  return { found: false };
}

async function waitForVideo(page, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      const v = videos.find((el) => el.src && el.src.startsWith('http'));
      if (!v) return { found: false };
      return {
        found: true,
        paused: v.paused,
        muted: v.muted,
        currentTime: v.currentTime,
        readyState: v.readyState,
        error: v.error ? v.error.code : null,
      };
    });
    if (state.found && !state.paused && state.currentTime > 0) {
      return { ...state, ms: Date.now() - start };
    }
    await page.waitForTimeout(250);
  }
  return await page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    const v = videos.find((el) => el.src && el.src.startsWith('http'));
    if (!v) return { found: false, timedOut: true };
    return {
      found: true,
      timedOut: true,
      paused: v.paused,
      muted: v.muted,
      currentTime: v.currentTime,
      readyState: v.readyState,
      error: v.error ? v.error.code : null,
    };
  });
}

async function probeScreen(browser, screenPath, label) {
  const results = {};
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();
    await seedSession(page);
    try {
      await openFeed(page, screenPath);
      await scrollToFirstVideo(page);
      const before = await waitForVideo(page);
      const pass =
        before.found &&
        !before.timedOut &&
        before.paused === false &&
        before.currentTime > 0;
      results[vp.label] = pass ? 'PASS' : 'FAIL';
      if (!pass) {
        results[`${vp.label}_detail`] = before;
      } else {
        results[`${vp.label}_ms`] = before.ms;
        await page.mouse.click(20, 20);
        await page.waitForTimeout(400);
        const after = await page.evaluate(() => {
          const v = document.querySelector('video');
          if (!v) return null;
          return {
            paused: v.paused,
            muted: v.muted,
            currentTime: v.currentTime,
          };
        });
        results[`${vp.label}_audio`] =
          after && !after.paused
            ? after.muted
              ? 'PASS_MUTED_STILL_PLAYING'
              : 'PASS_UNMUTED'
            : 'FAIL_STOPPED';
      }
    } catch (error) {
      results[vp.label] = 'FAIL';
      results[`${vp.label}_detail`] = String(error);
    } finally {
      await context.close();
    }
  }
  return { label, results };
}

const server = serveDist();
await new Promise((resolve) => server.listen(PORT, resolve));
const browser = await chromium.launch({ headless: true });

const screens = [
  { path: '/general', key: 'GENERAL' },
  { path: '/highlights', key: 'HIGHLIGHTS' },
];

const transition = {};
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await seedSession(page);
  try {
    await openFeed(page, '/general');
    await scrollToFirstVideo(page);
    const a = await waitForVideo(page, 12000);
    const box = page.viewportSize();
    if (box) await page.mouse.wheel(0, box.height * 0.95);
    await page.waitForTimeout(800);
    const b = await waitForVideo(page, 12000);
    const videos = await page.evaluate(() =>
      Array.from(document.querySelectorAll('video')).map((v) => ({
        paused: v.paused,
        currentTime: v.currentTime,
      }))
    );
    const playingCount = videos.filter(
      (v) => !v.paused && v.currentTime > 0
    ).length;
    transition.SINGLE_ACTIVE_VIDEO =
      a.found && b.found && playingCount <= 1 ? 'PASS' : 'FAIL';
    transition.detail = { a, b, playingCount, videos };
  } catch (error) {
    transition.SINGLE_ACTIVE_VIDEO = 'FAIL';
    transition.detail = String(error);
  } finally {
    await context.close();
  }
}

const report = { ...transition };
for (const screen of screens) {
  const out = await probeScreen(browser, screen.path, screen.key);
  for (const [k, v] of Object.entries(out.results)) {
    report[`${screen.key}_${k}`] = v;
  }
}

await browser.close();
server.close();

console.log(JSON.stringify(report, null, 2));

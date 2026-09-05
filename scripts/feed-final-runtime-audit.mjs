/**
 * Final feed runtime audit — local video fixture + Chrome headless.
 * Usage: npm run build:web && node scripts/feed-final-runtime-audit.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const FIXTURES = join(__dirname, 'fixtures');
const PORT = 4176;

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
  '.mp4': 'video/mp4',
};

const VIEWPORTS = [
  { label: '390', width: 390, height: 844 },
  { label: '768', width: 768, height: 1024 },
  { label: '1440', width: 1440, height: 900 },
];

let TEST_VIDEO = '';
let FIXTURE_BYTES = null;

async function installBrokenMediaRedirect(context) {
  FIXTURE_BYTES = FIXTURE_BYTES ?? (await readFile(join(FIXTURES, 'flower.mp4')));
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    const isBrokenProdVideo =
      url.includes('storage.googleapis.com/gtv-videos-bucket') ||
      url.includes('gtv-videos-bucket/sample/');
    if (isBrokenProdVideo) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' },
        body: FIXTURE_BYTES,
      });
      return;
    }
    await route.continue();
  });
}

async function scrollUntilPlaying(page, maxSteps = 28) {
  for (let i = 0; i < maxSteps; i += 1) {
    const s = await videoState(page);
    if (s.found && !s.paused && s.currentTime > 0) {
      return { ...s, timedOut: false, steps: i };
    }
    await scrollFeedPage(page, 720);
  }
  return { ...(await videoState(page)), timedOut: true };
}

function buildSeedUser(videoUrl) {
  return {
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
      canCreateContent: false,
    },
    posts: [],
    media: {
      photos: [],
      videos: [
        {
          id: 'runtime-user-video-1',
          url: videoUrl,
          likes: [],
          comments: [],
          timestamp: new Date().toISOString(),
        },
        {
          id: 'runtime-user-video-2',
          url: videoUrl,
          likes: [],
          comments: [],
          timestamp: new Date(Date.now() - 30000).toISOString(),
        },
      ],
    },
    personalityPhotos: [],
    comments: [],
    analysisContent: [
      {
        id: 'runtime-analysis-1',
        title: 'Runtime video test',
        content: 'Autoplay audit fixture',
        timestamp: new Date().toISOString(),
        likes: [],
        comments: [],
        videoUrl,
      },
      {
        id: 'runtime-analysis-2',
        title: 'Second clip',
        content: 'Transition test',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        likes: [],
        comments: [],
        videoUrl,
      },
    ],
  };
}

function buildSeedCompetitions(videoUrl) {
  return [
    {
      id: 'comp-runtime-1',
      visibleId: 'C9001',
      name: 'Runtime Cup',
      organizerId: 'organizer-1',
      logo: 'https://placehold.co/200x200.png',
      status: 'active',
      venue: {
        name: 'Test Stadium',
        country: 'Test',
        region: 'Test',
        city: 'Test',
      },
      staff: [],
      teams: [
        {
          id: 'team-runtime-1',
          name: 'Team A',
          competitionId: 'comp-runtime-1',
          logo: '',
          status: 'active',
          comments: [],
          players: [],
          officials: [],
        },
      ],
      matches: [
        {
          id: 'match-runtime-1',
          competitionId: 'comp-runtime-1',
          team1Id: 'team-runtime-1',
          team2Id: 'team-runtime-1',
          team1Score: 1,
          team2Score: 0,
          date: new Date().toISOString(),
          media: {
            photos: [],
            videos: [
              { id: 'video-runtime-1', url: videoUrl, likes: [], comments: [] },
              { id: 'video-runtime-2', url: videoUrl, likes: [], comments: [] },
            ],
          },
          comments: [],
          analysisContent: [],
        },
      ],
      media: {
        photos: [],
        videos: [{ id: 'comp-video-runtime-1', url: videoUrl, likes: [], comments: [] }],
      },
      refereeIds: [],
    },
  ];
}

function serveAll(baseUrl) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', baseUrl);
      let path = decodeURIComponent(url.pathname);
      if (path.startsWith('/fixtures/')) {
        const file = join(FIXTURES, path.replace('/fixtures/', ''));
        const data = await readFile(file);
        res.writeHead(200, {
          'Content-Type': MIME[extname(file)] || 'application/octet-stream',
        });
        res.end(data);
        return;
      }
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

async function seedPage(page, videoUrl) {
  const user = buildSeedUser(videoUrl);
  const competitions = buildSeedCompetitions(videoUrl);
  await page.addInitScript(({ user, competitions }) => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('sb-')) window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(
      'tajjd.secure.currentUser',
      JSON.stringify(user)
    );
    window.localStorage.setItem(
      'seellie.competitions',
      JSON.stringify(competitions)
    );
  }, { user, competitions });
}

async function dispatchWheel(page, deltaY = 400) {
  await page.evaluate((dy) => {
    document.dispatchEvent(
      new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true })
    );
  }, deltaY);
}

async function scrollFeedPage(page, deltaY) {
  const box = page.viewportSize();
  if (box) {
    await page.mouse.move(box.width / 2, box.height / 2);
    await page.mouse.wheel(0, deltaY);
  }
  await dispatchWheel(page, deltaY);
  await page.waitForTimeout(450);
}

async function waitFabOpacity(page, predicate, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await fabState(page);
    if (s.found && predicate(s.opacity)) return s;
    await page.waitForTimeout(80);
  }
  return fabState(page);
}

async function waitForApp(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const loading = /Loading|جاري/i.test(text.slice(0, 300));
      const hasUser = !!window.localStorage.getItem('tajjd.secure.currentUser');
      return { loading, hasUser, textLen: text.length };
    });
    if (!state.loading && state.hasUser && state.textLen > 40) return state;
    await page.waitForTimeout(300);
  }
  return { timedOut: true };
}

async function openFeed(page, baseUrl, route, { strict = false } = {}) {
  const candidates = strict
    ? [route]
    : [route, `/general`, `/highlights`, `/(follower)/general`, `/(follower)/highlights`];
  for (const r of [...new Set(candidates)]) {
    try {
      await page.goto(`${baseUrl}${r}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await waitForApp(page, 18000);
      await page.waitForTimeout(1500);
      const count = await page.evaluate(() => document.querySelectorAll('video').length);
      if (count > 0) return { route: r, videos: count };
    } catch {
      /* try next */
    }
  }
  return { route, videos: 0 };
}

async function videoState(page) {
  return page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    const playing = videos.filter((v) => !v.paused && v.currentTime > 0);
    const active =
      playing[0] ||
      videos.find((v) => v.src && v.src.length > 0);
    if (!active) {
      return { found: false, total: videos.length, playingCount: playing.length };
    }
    return {
      found: true,
      total: videos.length,
      playingCount: playing.length,
      paused: active.paused,
      muted: active.muted,
      volume: active.volume,
      currentTime: active.currentTime,
      readyState: active.readyState,
      src: active.src?.slice(0, 120),
    };
  });
}

async function waitPlaying(page, timeoutMs = 18000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await videoState(page);
    if (s.found && !s.paused && s.currentTime > 0) {
      return { ...s, timedOut: false, ms: Date.now() - start };
    }
    await page.waitForTimeout(250);
  }
  return { ...(await videoState(page)), timedOut: true };
}

async function fabState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-seellie-fab="1"]');
    if (!root) return { found: false };
    const el = root.firstElementChild || root;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      found: true,
      left: Math.round(rect.left),
      bottom: Math.round(window.innerHeight - rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      opacity: parseFloat(style.opacity || '1'),
      transform: style.transform,
    };
  });
}

async function probeEngine(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await installBrokenMediaRedirect(context);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/fixtures/flower.mp4`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await page.evaluate(async () => {
      const v = document.createElement('video');
      v.src = window.location.href;
      v.playsInline = true;
      v.loop = true;
      v.muted = false;
      v.volume = 1;
      document.body.appendChild(v);
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('load timeout')), 12000);
        v.addEventListener('loadeddata', () => { clearTimeout(t); resolve(null); }, { once: true });
      });
      let audibleError = null;
      try {
        await v.play();
      } catch (e) {
        audibleError = String(e);
        v.muted = true;
        await v.play();
      }
      await new Promise((r) => setTimeout(r, 400));
      return {
        paused: v.paused,
        muted: v.muted,
        volume: v.volume,
        currentTime: v.currentTime,
        audibleError,
      };
    });
    const videoPass = !result.paused && result.currentTime > 0;
    const audioPass = videoPass && !result.muted && result.volume > 0;
    return {
      ENGINE_VIDEO_AUTOPLAY: videoPass ? 'PASS' : 'FAIL',
      ENGINE_AUDIO_AUTOPLAY: audioPass ? 'PASS' : result.muted ? 'MUTED_FALLBACK' : 'FAIL',
      ENGINE_detail: result,
    };
  } catch (error) {
    return { ENGINE_VIDEO_AUTOPLAY: 'FAIL', ENGINE_detail: String(error) };
  } finally {
    await context.close();
  }
}

async function probeScreen(browser, baseUrl, screenKey, route) {
  const out = {};
  for (const vp of VIEWPORTS) {
    const key = `${screenKey}_${vp.label}`;
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    await installBrokenMediaRedirect(context);
    const page = await context.newPage();
    await seedPage(page, TEST_VIDEO);
    try {
      const opened = await openFeed(page, baseUrl, route, { strict: true });
      let play = await scrollUntilPlaying(page, opened.videos > 0 ? 6 : 24);
      if (!play.found || play.timedOut || play.paused) {
        play = await waitPlaying(page, 8000);
      }

      await page.waitForTimeout(1200);
      const fabIdle = await fabState(page);
      if (vp.width < 1024) {
        await dispatchWheel(page, 320);
        await page.waitForTimeout(200);
      }
      const fabScroll = await waitFabOpacity(
        page,
        (o) => o < 0.5 && o > 0.05,
        2500
      );
      await page.waitForTimeout(750);
      const fabAfter = await waitFabOpacity(page, (o) => o >= 0.85, 3000);

      const videoPass = play.found && !play.timedOut && !play.paused && play.currentTime > 0;
      const audioPass = videoPass && play.muted === false && play.volume > 0;
      const isDesktop = vp.width >= 1024;

      out[`${key}_VIDEO`] = videoPass ? 'PASS' : opened.videos === 0 ? 'FAIL_NO_VIDEO_ELEMENT' : 'FAIL';
      out[`${key}_AUDIO`] = audioPass ? 'PASS' : videoPass && play.muted ? 'MUTED_AT_RUNTIME' : videoPass ? 'LOW_VOLUME' : 'NOT_MEASURED';
      out[`${key}_SINGLE_ACTIVE`] = (play.playingCount ?? 0) <= 1 ? 'PASS' : `FAIL_${play.playingCount}`;
      out[`${key}_FAB_DIM_ON_SCROLL`] = isDesktop ? 'N/A_DESKTOP' : fabScroll.found && fabScroll.opacity < 0.5 && fabScroll.opacity > 0 ? 'PASS' : fabScroll.found ? `FAIL_OPACITY_${fabScroll.opacity}` : 'FAIL_NO_FAB';
      out[`${key}_FAB_RETURN`] = isDesktop ? 'N/A_DESKTOP' : fabAfter.found && fabAfter.opacity >= 0.85 ? 'PASS' : 'FAIL';
      out[`${key}_FAB_STABLE`] = isDesktop ? 'N/A_DESKTOP' : fabIdle.found && fabAfter.found && Math.abs((fabIdle.left||0)-(fabAfter.left||0))<=3 && Math.abs((fabIdle.bottom||0)-(fabAfter.bottom||0))<=3 ? 'PASS' : 'FAIL';
      out[`${key}_detail`] = { opened, play, fabIdle, fabScroll, fabAfter };
    } catch (error) {
      out[`${key}_VIDEO`] = 'FAIL';
      out[`${key}_detail`] = String(error);
    } finally {
      await context.close();
    }
  }
  return out;
}

async function probeTransitions(browser, baseUrl, route) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installBrokenMediaRedirect(context);
  const page = await context.newPage();
  await seedPage(page, TEST_VIDEO);
  try {
    await openFeed(page, baseUrl, route);
    const a = await scrollUntilPlaying(page, 8);
    await scrollFeedPage(page, 820);
    const b = await waitPlaying(page, 12000);
    const mid = await videoState(page);
    await scrollFeedPage(page, 820);
    const c = await waitPlaying(page, 12000);
    await scrollFeedPage(page, -1640);
    const back = await waitPlaying(page, 12000);
    return {
      TRANSITION_A_PLAYING: a.found && !a.paused && a.currentTime > 0 ? 'PASS' : 'FAIL',
      TRANSITION_B_PLAYING: b.found && !b.paused && b.currentTime > 0 ? 'PASS' : 'FAIL',
      TRANSITION_C_PLAYING: c.found && !c.paused && c.currentTime > 0 ? 'PASS' : 'FAIL',
      TRANSITION_RESUME: back.found && !back.paused && back.currentTime > 0 ? 'PASS' : 'FAIL',
      TRANSITION_SINGLE_ACTIVE: (mid.playingCount ?? 0) <= 1 ? 'PASS' : `FAIL_${mid.playingCount}`,
      TRANSITION_STOP_ON_LEAVE: mid.total <= 1 ? 'PASS' : 'CHECK',
      TRANSITION_detail: { a, b, c, mid, back },
    };
  } catch (error) {
    return { TRANSITION_A_PLAYING: 'FAIL', TRANSITION_detail: String(error) };
  } finally {
    await context.close();
  }
}

const report = {
  NATIVE_IOS: 'NOT_MEASURED — no iOS Simulator/device or cloud credentials in this environment',
  NATIVE_ANDROID: 'NOT_MEASURED — no Android Emulator/device or cloud credentials in this environment',
  BROWSER: 'Google Chrome via Playwright channel:chrome',
};

await stat(join(FIXTURES, 'flower.mp4'));

const server = serveAll(`http://127.0.0.1:${PORT}`);
await new Promise((resolve) => server.listen(PORT, resolve));
const BASE = `http://127.0.0.1:${PORT}`;
TEST_VIDEO = `${BASE}/fixtures/flower.mp4`;
report.TEST_VIDEO_URL = TEST_VIDEO;

const headless = process.env.RUNTIME_HEADED !== '1';
const browser = await chromium.launch({
  channel: 'chrome',
  headless,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
report.CHROME_HEADLESS = headless;

Object.assign(report, await probeEngine(browser, BASE));
Object.assign(report, await probeTransitions(browser, BASE, '/general'));
Object.assign(report, await probeScreen(browser, BASE, 'GENERAL', '/general'));
Object.assign(report, await probeScreen(browser, BASE, 'HIGHLIGHTS', '/highlights'));

await browser.close();
server.close();

console.log(JSON.stringify(report, null, 2));

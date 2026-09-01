/**
 * Chromium runtime — muted autoplay + gesture unmute (mirrors media-autoplay-engine).
 */
import { chromium } from 'playwright';

const PORT = 4188;
const VIDEO =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const html = `<!doctype html><html><body style="margin:0;background:#000">
<video id="v" playsinline muted loop preload="auto" style="width:100vw;height:100vh;object-fit:cover" src="${VIDEO}"></video>
</body></html>`;

import { createServer } from 'node:http';
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });

const autoplay = await page.evaluate(async () => {
  const v = document.getElementById('v');
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('load timeout')), 15000);
    v.addEventListener(
      'loadeddata',
      () => {
        clearTimeout(t);
        resolve(null);
      },
      { once: true }
    );
  });
  v.muted = true;
  v.defaultMuted = true;
  await v.play();
  await new Promise((r) => setTimeout(r, 600));
  return {
    paused: v.paused,
    muted: v.muted,
    currentTime: v.currentTime,
    readyState: v.readyState,
  };
});

const afterGesture = await page.evaluate(async () => {
  const v = document.getElementById('v');
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  v.muted = false;
  if (v.paused) {
    v.muted = true;
    await v.play();
  }
  await new Promise((r) => setTimeout(r, 300));
  return {
    paused: v.paused,
    muted: v.muted,
    currentTime: v.currentTime,
  };
});

await browser.close();
server.close();

const videoPass =
  autoplay.paused === false && autoplay.currentTime > 0 && autoplay.muted === true;
const audioPass = afterGesture.paused === false;

console.log(
  JSON.stringify(
    {
      CHROME_MUTED_AUTOPLAY_NO_TAP: videoPass ? 'PASS' : 'FAIL',
      CHROME_AUDIO_AFTER_GESTURE: audioPass ? 'PASS' : 'FAIL',
      autoplay,
      afterGesture,
    },
    null,
    2
  )
);

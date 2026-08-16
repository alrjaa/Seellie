#!/usr/bin/env node
/**
 * F12-P2-01 — Patch Expo web export HTML so the initial server HTML includes
 * interactive-widget=resizes-visual (Expo SPA template omits it; +html.tsx is not applied).
 */
const fs = require('fs');
const path = require('path');

const VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-visual';

const VIEWPORT_META = `<meta name="viewport" content="${VIEWPORT_CONTENT}" />`;

const VIEWPORT_RE =
  /<meta\s+[^>]*name=["']viewport["'][^>]*>/i;

function listHtmlFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === '_expo' || name === 'assets' || name === 'node_modules') continue;
      out.push(...listHtmlFiles(full));
    } else if (name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function patchHtml(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const matches = raw.match(new RegExp(VIEWPORT_RE.source, 'gi')) || [];
  if (matches.length === 0) {
    throw new Error(`F12-P2-01: no viewport meta in ${file}`);
  }
  if (matches.length > 1) {
    throw new Error(
      `F12-P2-01: duplicate viewport meta (${matches.length}) in ${file}`
    );
  }

  const next = raw.replace(VIEWPORT_RE, VIEWPORT_META);
  const after = next.match(new RegExp(VIEWPORT_RE.source, 'gi')) || [];
  if (after.length !== 1) {
    throw new Error(`F12-P2-01: expected 1 viewport after patch in ${file}`);
  }
  if (!after[0].includes('interactive-widget=resizes-visual')) {
    throw new Error(`F12-P2-01: interactive-widget missing after patch in ${file}`);
  }
  if (!after[0].includes('viewport-fit=cover')) {
    throw new Error(`F12-P2-01: viewport-fit missing after patch in ${file}`);
  }

  if (next !== raw) {
    fs.writeFileSync(file, next, 'utf8');
    console.log(`patched viewport: ${file}`);
  } else {
    console.log(`viewport already correct: ${file}`);
  }
}

function main() {
  const root = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), 'dist');
  const files = listHtmlFiles(root);
  if (files.length === 0) {
    throw new Error(`F12-P2-01: no HTML files under ${root}`);
  }
  for (const file of files) patchHtml(file);
  console.log(`F12-P2-01 viewport patch OK (${files.length} file(s))`);
}

main();

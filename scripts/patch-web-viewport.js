#!/usr/bin/env node
/**
 * F12-P2-01 — Patch Expo web export HTML:
 * 1) interactive-widget viewport (Expo SPA omits it; +html.tsx is not applied)
 * 2) SEO meta description / OG tags / lang=ar so search snippets are not login-form text
 */
const fs = require('fs');
const path = require('path');

const VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-visual';

const VIEWPORT_META = `<meta name="viewport" content="${VIEWPORT_CONTENT}" />`;

const VIEWPORT_RE =
  /<meta\s+[^>]*name=["']viewport["'][^>]*>/i;

const SITE_TITLE = 'Seellie';
const SITE_DESCRIPTION =
  'Seellie منصة رياضية متكاملة لتنظيم وإدارة البطولات، ومتابعة المباريات والنتائج والفرق واللاعبين في مكان واحد.';

const SEO_MARKER = 'data-seellie-seo="1"';

const SEO_HEAD = `
    <meta name="description" content="${SITE_DESCRIPTION}" ${SEO_MARKER} />
    <meta name="application-name" content="${SITE_TITLE}" ${SEO_MARKER} />
    <meta name="theme-color" content="#0d1a26" ${SEO_MARKER} />
    <meta name="robots" content="index,follow" ${SEO_MARKER} />
    <meta property="og:type" content="website" ${SEO_MARKER} />
    <meta property="og:site_name" content="${SITE_TITLE}" ${SEO_MARKER} />
    <meta property="og:title" content="${SITE_TITLE}" ${SEO_MARKER} />
    <meta property="og:description" content="${SITE_DESCRIPTION}" ${SEO_MARKER} />
    <meta property="og:locale" content="ar_SA" ${SEO_MARKER} />
    <meta property="og:url" content="https://www.seellie.com/" ${SEO_MARKER} />
    <meta name="twitter:card" content="summary" ${SEO_MARKER} />
    <meta name="twitter:title" content="${SITE_TITLE}" ${SEO_MARKER} />
    <meta name="twitter:description" content="${SITE_DESCRIPTION}" ${SEO_MARKER} />
    <link rel="canonical" href="https://www.seellie.com/" ${SEO_MARKER} />`;

const SEO_NOSCRIPT = `
    <noscript ${SEO_MARKER}>
      <h1>${SITE_TITLE}</h1>
      <p>${SITE_DESCRIPTION}</p>
    </noscript>`;

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

function stripPreviousSeo(html) {
  return html
    .replace(
      /\s*<meta[^>]*data-seellie-seo=["']1["'][^>]*>/gi,
      ''
    )
    .replace(
      /\s*<link[^>]*data-seellie-seo=["']1["'][^>]*>/gi,
      ''
    )
    .replace(
      /\s*<noscript[^>]*data-seellie-seo=["']1["'][^>]*>[\s\S]*?<\/noscript>/gi,
      ''
    );
}

function patchHtml(file) {
  let raw = fs.readFileSync(file, 'utf8');
  raw = stripPreviousSeo(raw);

  const matches = raw.match(new RegExp(VIEWPORT_RE.source, 'gi')) || [];
  if (matches.length === 0) {
    throw new Error(`F12-P2-01: no viewport meta in ${file}`);
  }
  if (matches.length > 1) {
    throw new Error(
      `F12-P2-01: duplicate viewport meta (${matches.length}) in ${file}`
    );
  }

  let next = raw.replace(VIEWPORT_RE, `${VIEWPORT_META}${SEO_HEAD}`);

  // عنوان ثابت نظيف
  next = next.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${SITE_TITLE}</title>`
  );

  // لغة عربية للصفحة العامة
  next = next.replace(/<html\b([^>]*)>/i, (full, attrs) => {
    let a = attrs || '';
    if (/\blang=/.test(a)) {
      a = a.replace(/\blang=["'][^"']*["']/, 'lang="ar"');
    } else {
      a += ' lang="ar"';
    }
    if (/\bdir=/.test(a)) {
      a = a.replace(/\bdir=["'][^"']*["']/, 'dir="rtl"');
    } else {
      a += ' dir="rtl"';
    }
    return `<html${a}>`;
  });

  if (!/<body[^>]*>/i.test(next)) {
    throw new Error(`F12-P2-01: no <body> in ${file}`);
  }
  next = next.replace(/<body([^>]*)>/i, `<body$1>${SEO_NOSCRIPT}`);

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
  if (!next.includes('name="description"')) {
    throw new Error(`F12-P2-01: SEO description missing after patch in ${file}`);
  }

  fs.writeFileSync(file, next, 'utf8');
  console.log(`patched viewport+seo: ${file}`);
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
  console.log(`F12-P2-01 viewport+seo patch OK (${files.length} file(s))`);
}

main();

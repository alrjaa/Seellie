import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

const SITE_TITLE = 'Seellie';
const SITE_DESCRIPTION =
  'Seellie منصة رياضية متكاملة لتنظيم وإدارة البطولات، ومتابعة المباريات والنتائج والفرق واللاعبين في مكان واحد.';

/**
 * غلاف HTML للويب — عنوان ووصف ثابتان لمحركات البحث، ومنع الكاش القديم.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-visual"
        />
        <meta
          httpEquiv="Cache-Control"
          content="no-cache, no-store, must-revalidate"
        />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />

        <title>{SITE_TITLE}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta name="application-name" content={SITE_TITLE} />
        <meta name="theme-color" content="#0d1a26" />
        <meta name="robots" content="index,follow" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_TITLE} />
        <meta property="og:title" content={SITE_TITLE} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:locale" content="ar_SA" />
        <meta property="og:url" content="https://www.seellie.com/" />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={SITE_TITLE} />
        <meta name="twitter:description" content={SITE_DESCRIPTION} />

        <link rel="canonical" href="https://www.seellie.com/" />

        <ScrollViewStyleReset />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    if (document.title && /^\\(\\d+\\)\\s+/.test(document.title)) {
      document.title = document.title.replace(/^\\(\\d+\\)\\s+/, '') || '${SITE_TITLE}';
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { r.unregister(); });
      });
    }
    if (window.caches && caches.keys) {
      caches.keys().then(function (keys) {
        keys.forEach(function (k) { caches.delete(k); });
      });
    }
  } catch (e) {}
})();`,
          }}
        />
      </head>
      <body>
        {/* نص ثابت لمحركات البحث قبل تحميل JS — لا يظهر بصرياً */}
        <div
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          <h1>{SITE_TITLE}</h1>
          <p>{SITE_DESCRIPTION}</p>
        </div>
        {children}
      </body>
    </html>
  );
}

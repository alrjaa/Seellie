import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * غلاف HTML للويب — يمنع المتصفح من إعادة استخدام صفحة قديمة بعد كل نشر.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta
          httpEquiv="Cache-Control"
          content="no-cache, no-store, must-revalidate"
        />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <title>Seellie</title>
        <ScrollViewStyleReset />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
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
      <body>{children}</body>
    </html>
  );
}

import { Platform } from 'react-native';

/** حد أدنى يمنع زوم iOS Safari عند التركيز على حقول الإدخال (ويب فقط) */
export const WEB_INPUT_MIN_FONT_SIZE = 16;

let installed = false;

/**
 * يضمن meta viewport المناسب للوحة المفاتيح دون الاعتماد على تصدير Expo لـ +html.
 * interactive-widget=resizes-visual: لا يعيد تحجيم layout عند فتح الكيبورد.
 */
export function ensureWebViewportMeta() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const current = meta.getAttribute('content') || '';
  const parts = current
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith('interactive-widget='));
  if (!parts.some((p) => p.startsWith('width='))) {
    parts.unshift('width=device-width');
  }
  if (!parts.some((p) => p.startsWith('initial-scale='))) {
    parts.push('initial-scale=1');
  }
  if (!parts.some((p) => p === 'shrink-to-fit=no')) {
    parts.push('shrink-to-fit=no');
  }
  if (!parts.some((p) => p.startsWith('viewport-fit='))) {
    parts.push('viewport-fit=cover');
  }
  parts.push('interactive-widget=resizes-visual');
  meta.setAttribute('content', parts.join(', '));
}

/**
 * حراسة واحدة مشتركة: قفل scroll القفزي لـ Safari أثناء التركيز على أي input/textarea.
 * لا تغيّر ارتفاع الـ layout — فقط تمنع سحب الصفحة.
 */
function installWebInputFocusGuards() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if ((window as unknown as { __seellieKbGuards?: boolean }).__seellieKbGuards) {
    return;
  }
  (window as unknown as { __seellieKbGuards?: boolean }).__seellieKbGuards = true;

  let focusing = false;
  let lockedY = 0;
  let raf: number | null = null;

  const isField = (t: EventTarget | null) => {
    if (!(t instanceof HTMLElement)) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
  };

  const stabilize = () => {
    if (!focusing) return;
    const y = window.scrollY || 0;
    if (Math.abs(y - lockedY) > 1) {
      window.scrollTo({ top: lockedY, left: 0, behavior: 'auto' });
    }
  };

  const schedule = () => {
    if (raf != null) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      stabilize();
    });
  };

  document.addEventListener(
    'focusin',
    (e) => {
      if (!isField(e.target)) return;
      focusing = true;
      lockedY = window.scrollY || 0;
    },
    true
  );

  document.addEventListener(
    'focusout',
    (e) => {
      if (!isField(e.target)) return;
      // تأخير قصير للسماح بالانتقال بين حقول متجاورة
      setTimeout(() => {
        const active = document.activeElement;
        if (!isField(active)) focusing = false;
      }, 50);
    },
    true
  );

  const vv = window.visualViewport;
  vv?.addEventListener('resize', schedule);
  vv?.addEventListener('scroll', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
}

/**
 * أنماط ويب مركزية: منع زوم الإدخال + overflow أفقي + viewport مستقر.
 * تُستدعى مرة واحدة من جذر التطبيق.
 */
export function injectWebKeyboardViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (installed) {
    ensureWebViewportMeta();
    return;
  }
  installed = true;

  ensureWebViewportMeta();
  installWebInputFocusGuards();

  const id = 'seellie-web-keyboard-viewport';
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    html {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
      overflow-x: hidden;
      max-width: 100%;
    }
    html, body, #root {
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }
    body {
      overscroll-behavior-x: none;
    }
    /* لمس: ≥16px يمنع زوم Safari/Chrome على أي TextInput في التطبيق */
    @media (hover: none), (pointer: coarse) {
      input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
      textarea,
      select {
        font-size: ${WEB_INPUT_MIN_FONT_SIZE}px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

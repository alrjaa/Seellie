import { Platform } from 'react-native';

/** أنماط عامة لسطح المكتب في المتصفح فقط */
export function injectDesktopWebStyles() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const id = 'seellie-desktop-web-styles';
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    html, body, #root {
      height: 100%;
      min-height: 100%;
      margin: 0;
      background: #0d1a26;
    }
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      overflow: hidden;
    }
    * {
      box-sizing: border-box;
    }
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.04);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(37,244,238,0.28);
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: content-box;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(37,244,238,0.45);
      background-clip: content-box;
    }
    input, textarea, button, select {
      outline-color: #25F4EE;
    }
    a {
      color: inherit;
    }
    /* محاذاة عربية على سطح المكتب */
    html[dir="rtl"] body,
    html[dir="rtl"] #root {
      text-align: right;
      direction: rtl;
    }
    html[dir="rtl"] input:not([dir="ltr"]),
    html[dir="rtl"] textarea:not([dir="ltr"]) {
      text-align: right;
      direction: rtl;
    }
  `;
  document.head.appendChild(style);
}

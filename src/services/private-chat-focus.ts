type Listener = (focused: boolean) => void;

let composerFocused = false;
const listeners = new Set<Listener>();

/** يُضبط فقط من onFocus/onBlur لملحّن الرسالة الخاصة — لإخفاء شريط التبويب */
export function setPrivateChatComposerFocused(focused: boolean) {
  if (composerFocused === focused) return;
  composerFocused = focused;
  listeners.forEach((fn) => {
    try {
      fn(focused);
    } catch {
      // ignore
    }
  });
}

export function isPrivateChatComposerFocused() {
  return composerFocused;
}

export function subscribePrivateChatComposerFocus(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

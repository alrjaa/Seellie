type Listener = (focused: boolean) => void;

let composerFocused = false;
const listeners = new Set<Listener>();

/** يُستخدم لإخفاء شريط التبويب أثناء كتابة رسالة خاصة على الجوال */
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

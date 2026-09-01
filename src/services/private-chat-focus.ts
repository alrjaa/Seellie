type Listener = (focused: boolean) => void;

let composerFocused = false;
let privateScreenFocused = false;
let activeFriendId: string | null = null;
const listeners = new Set<Listener>();

/**
 * يُضبط من onFocus/onBlur لملحّن الكتابة (خاصة / تعليقات المحتوى)
 * لإخفاء شريط التبويب أثناء لوحة المفاتيح — نفس النظام الحالي.
 */
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

/** المحادثة النشطة أثناء بقاء شاشة الخاصة في المقدمة. */
export function setPrivateChatView(
  friendId: string | null,
  screenFocused: boolean
) {
  activeFriendId = friendId;
  privateScreenFocused = screenFocused;
}

export function isViewingPrivateFriend(friendId: string) {
  return privateScreenFocused && activeFriendId === friendId;
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

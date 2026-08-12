import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, Platform, type View } from 'react-native';

export type PrivateChatKeyboardState = {
  /** فتح اللوحة — مستقل عن تركيز حقل الكتابة */
  keyboardOpen: boolean;
  /**
   * ارتفاع غلاف المحادثة أثناء فتح اللوحة وتركيز الملحّن (ويب فقط).
   * null = استخدم الارتفاع الأساسي دون تعديل لوحة المفاتيح.
   */
  chatHeightOverride: number | null;
};

type Options = {
  active: boolean;
  composerFocused: boolean;
  /** مرجع غلاف المحادثة لقياس المساحة فوق اللوحة */
  containerRef: RefObject<View | null>;
};

const FOCUS_CLASS = 'seellie-private-chat-composer';

type LayoutSnapshot = {
  keyboardOpen: boolean;
  chatHeightOverride: number | null;
};

/**
 * مصدر واحد لتخطيط لوحة مفاتيح محادثة خاصة.
 *
 * الويب: يقيس المسافة من أعلى حاوية المحادثة إلى أسفل visualViewport.
 * لا يخصم keyboardInset من windowHeight (يمنع التصغير المزدوج مع Dimensions).
 * لا يثبّت document.body.
 *
 * native: يبلّغ keyboardOpen فقط؛ الموضع عبر KeyboardAvoidingView.
 */
export function usePrivateChatKeyboard({
  active,
  composerFocused,
  containerRef,
}: Options): PrivateChatKeyboardState {
  const [state, setState] = useState<LayoutSnapshot>({
    keyboardOpen: false,
    chatHeightOverride: null,
  });
  const focusedRef = useRef(composerFocused);
  focusedRef.current = composerFocused;
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<LayoutSnapshot>({
    keyboardOpen: false,
    chatHeightOverride: null,
  });

  const apply = useCallback((next: LayoutSnapshot) => {
    const prev = lastRef.current;
    if (
      prev.keyboardOpen === next.keyboardOpen &&
      prev.chatHeightOverride === next.chatHeightOverride
    ) {
      return;
    }
    lastRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    if (!active) {
      apply({ keyboardOpen: false, chatHeightOverride: null });
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.documentElement.classList.remove(FOCUS_CLASS);
      }
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const vv = window.visualViewport;

      const updateChatKeyboardLayout = () => {
        if (!focusedRef.current) {
          apply({ keyboardOpen: false, chatHeightOverride: null });
          return;
        }

        const layoutH = window.innerHeight;
        const vvHeight = vv?.height ?? layoutH;
        const vvTop = vv?.offsetTop ?? 0;
        const covered = Math.max(0, layoutH - vvHeight - vvTop);
        const open = covered > 0;

        if (!open) {
          apply({ keyboardOpen: false, chatHeightOverride: null });
          return;
        }

        const node = containerRef.current;
        if (!node || typeof node.measureInWindow !== 'function') {
          // بدون قياس الحاوية لا نخمّن ارتفاعًا من Dimensions (سبب الفراغ السابق)
          apply({ keyboardOpen: true, chatHeightOverride: null });
          return;
        }

        node.measureInWindow((_x, y) => {
          if (!focusedRef.current) return;
          const vvBottom = vvTop + vvHeight;
          // المساحة الفعلية من أعلى غلاف المحادثة إلى أعلى اللوحة
          const available = Math.round(vvBottom - y);
          apply({
            keyboardOpen: true,
            chatHeightOverride: Math.max(0, available),
          });
        });
      };

      const schedule = () => {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          updateChatKeyboardLayout();
        });
      };

      if (composerFocused) {
        document.documentElement.classList.add(FOCUS_CLASS);
      } else {
        document.documentElement.classList.remove(FOCUS_CLASS);
        apply({ keyboardOpen: false, chatHeightOverride: null });
      }

      schedule();
      vv?.addEventListener('resize', schedule);
      vv?.addEventListener('scroll', schedule);
      window.addEventListener('resize', schedule);

      return () => {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        vv?.removeEventListener('resize', schedule);
        vv?.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        document.documentElement.classList.remove(FOCUS_CLASS);
        apply({ keyboardOpen: false, chatHeightOverride: null });
      };
    }

    const show =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(show, () => {
      if (!focusedRef.current) {
        apply({ keyboardOpen: false, chatHeightOverride: null });
        return;
      }
      apply({ keyboardOpen: true, chatHeightOverride: null });
    });
    const onHide = Keyboard.addListener(hide, () => {
      apply({ keyboardOpen: false, chatHeightOverride: null });
    });

    return () => {
      onShow.remove();
      onHide.remove();
      apply({ keyboardOpen: false, chatHeightOverride: null });
    };
  }, [active, composerFocused, containerRef, apply]);

  return state;
}

/**
 * ارتفاع نافذة التخطيط على الويب (innerHeight) — لا يتبع visualViewport.
 * على native يُعاد windowHeight كما هو.
 */
export function getLayoutViewportHeight(windowHeight: number): number {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerHeight || windowHeight;
  }
  return windowHeight;
}

import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export type PrivateChatKeyboardState = {
  /** قياس حقيقي لفتح اللوحة — مستقل عن تركيز حقل الكتابة */
  keyboardOpen: boolean;
  /**
   * المسافة التي تغطيها اللوحة من أسفل نافذة التخطيط.
   * تُطبَّق على الويب فقط عندما يكون ملحّن المحادثة هو المركّز.
   * على native تبقى 0 لأن KeyboardAvoidingView / windowSoftInputMode هما المسؤولان.
   */
  keyboardInset: number;
};

type Options = {
  /** قسم المحادثة نشط */
  active: boolean;
  /** تركيز حقل رسالة المحادثة الخاصة فقط */
  composerFocused: boolean;
};

const FOCUS_CLASS = 'seellie-private-chat-composer';

/**
 * مصدر واحد لحساب تداخل لوحة المفاتيح مع محادثة خاصة.
 * لا يغيّر body.position، ولا يخلط بين keyboardOpen وcomposerFocused.
 */
export function usePrivateChatKeyboard({
  active,
  composerFocused,
}: Options): PrivateChatKeyboardState {
  const [state, setState] = useState<PrivateChatKeyboardState>({
    keyboardOpen: false,
    keyboardInset: 0,
  });
  const focusedRef = useRef(composerFocused);
  focusedRef.current = composerFocused;
  const lockedScrollY = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastInsetRef = useRef(0);

  useEffect(() => {
    if (!active) {
      lastInsetRef.current = 0;
      setState({ keyboardOpen: false, keyboardInset: 0 });
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.documentElement.classList.remove(FOCUS_CLASS);
      }
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const vv = window.visualViewport;

      const publish = () => {
        if (!focusedRef.current) {
          if (lastInsetRef.current !== 0) {
            lastInsetRef.current = 0;
            setState({ keyboardOpen: false, keyboardInset: 0 });
          } else {
            setState((prev) =>
              prev.keyboardOpen || prev.keyboardInset
                ? { keyboardOpen: false, keyboardInset: 0 }
                : prev
            );
          }
          return;
        }

        const layoutH = window.innerHeight;
        const vvHeight = vv?.height ?? layoutH;
        const vvTop = vv?.offsetTop ?? 0;
        const inset = Math.max(0, Math.round(layoutH - vvHeight - vvTop));
        const open = inset > 0;

        if (inset === lastInsetRef.current) {
          setState((prev) =>
            prev.keyboardOpen === open && prev.keyboardInset === inset
              ? prev
              : { keyboardOpen: open, keyboardInset: inset }
          );
          return;
        }
        lastInsetRef.current = inset;
        setState({ keyboardOpen: open, keyboardInset: inset });
      };

      const schedule = () => {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          publish();
        });
      };

      if (composerFocused) {
        lockedScrollY.current = window.scrollY || 0;
        document.documentElement.classList.add(FOCUS_CLASS);
        publish();
      } else {
        document.documentElement.classList.remove(FOCUS_CLASS);
        lastInsetRef.current = 0;
        setState({ keyboardOpen: false, keyboardInset: 0 });
      }

      /** Safari يحرّك تمرير الصفحة لإظهار الحقل — نعيد الموضع المحفوظ عند التركيز فقط */
      const onVvScroll = () => {
        if (!focusedRef.current) return;
        const y = lockedScrollY.current;
        if (Math.abs((window.scrollY || 0) - y) > 0.5) {
          window.scrollTo({ top: y, left: 0, behavior: 'auto' });
        }
        schedule();
      };

      vv?.addEventListener('resize', schedule);
      vv?.addEventListener('scroll', onVvScroll);
      window.addEventListener('resize', schedule);

      return () => {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        vv?.removeEventListener('resize', schedule);
        vv?.removeEventListener('scroll', onVvScroll);
        window.removeEventListener('resize', schedule);
        document.documentElement.classList.remove(FOCUS_CLASS);
        lastInsetRef.current = 0;
        setState({ keyboardOpen: false, keyboardInset: 0 });
      };
    }

    // iOS/Android: لا نخصم ارتفاعاً هنا — Screen.KeyboardAvoidingView أو resize النافذة
    const show =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(show, () => {
      if (!focusedRef.current) {
        setState({ keyboardOpen: false, keyboardInset: 0 });
        return;
      }
      setState({ keyboardOpen: true, keyboardInset: 0 });
    });
    const onHide = Keyboard.addListener(hide, () => {
      setState({ keyboardOpen: false, keyboardInset: 0 });
    });

    return () => {
      onShow.remove();
      onHide.remove();
      setState({ keyboardOpen: false, keyboardInset: 0 });
    };
  }, [active, composerFocused]);

  return state;
}

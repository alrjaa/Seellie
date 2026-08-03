import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type FloatingChromeContextValue = {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  /** ربطه بـ onScroll للقوائم والشاشات القابلة للتمرير */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: () => void;
  onScrollEndDrag: () => void;
  onMomentumScrollEnd: () => void;
};

const FloatingChromeContext = createContext<FloatingChromeContextValue | null>(
  null
);

/**
 * يُخفي الأزرار العائمة أثناء التمرير ويُظهرها بعد التوقف.
 */
export function FloatingChromeProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleShow = useCallback(() => {
    clearTimer();
    hideTimer.current = setTimeout(() => setVisible(true), 700);
  }, [clearTimer]);

  const onScrollBeginDrag = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (Math.abs(y - lastY.current) > 4) {
        setVisible(false);
        clearTimer();
      }
      lastY.current = y;
    },
    [clearTimer]
  );

  const onScrollEndDrag = useCallback(() => {
    scheduleShow();
  }, [scheduleShow]);

  const onMomentumScrollEnd = useCallback(() => {
    scheduleShow();
  }, [scheduleShow]);

  const value = useMemo(
    () => ({
      visible,
      setVisible,
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollEnd,
    }),
    [
      visible,
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollEnd,
    ]
  );

  return (
    <FloatingChromeContext.Provider value={value}>
      {children}
    </FloatingChromeContext.Provider>
  );
}

export function useFloatingChrome() {
  const ctx = useContext(FloatingChromeContext);
  if (!ctx) {
    return {
      visible: true,
      setVisible: (_: boolean) => undefined,
      onScroll: (_: NativeSyntheticEvent<NativeScrollEvent>) => undefined,
      onScrollBeginDrag: () => undefined,
      onScrollEndDrag: () => undefined,
      onMomentumScrollEnd: () => undefined,
    };
  }
  return ctx;
}

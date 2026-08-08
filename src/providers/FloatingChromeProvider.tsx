import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type VisibilityValue = {
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

type ScrollHandlersValue = {
  /** ربطه بـ onScroll للقوائم والشاشات القابلة للتمرير */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: () => void;
  onScrollEndDrag: (
    e?: NativeSyntheticEvent<NativeScrollEvent>
  ) => void;
  onMomentumScrollBegin: () => void;
  onMomentumScrollEnd: () => void;
};

const FloatingChromeVisibilityContext =
  createContext<VisibilityValue | null>(null);

const FloatingChromeScrollContext =
  createContext<ScrollHandlersValue | null>(null);

/** إظهار الأزرار فقط بعد توقف حقيقي عن التمرير — يمنع الاهتزاز */
const SHOW_AFTER_IDLE_MS = 700;

/**
 * يُخفي الأزرار العائمة أثناء التمرير ويُظهرها بعد التوقف.
 * لا يُعاد إظهارها أثناء onScroll حتى لا يحدث تردد (إظهار↔إخفاء).
 */
export function FloatingChromeProvider({ children }: { children: ReactNode }) {
  const [visible, setVisibleState] = useState(true);
  const visibleRef = useRef(true);
  const lastY = useRef(0);
  const interacting = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  }, []);

  const setVisible = useCallback((next: boolean) => {
    if (visibleRef.current === next) return;
    visibleRef.current = next;
    setVisibleState(next);
  }, []);

  const scheduleShow = useCallback(() => {
    clearTimer();
    showTimer.current = setTimeout(() => {
      if (!interacting.current && !visibleRef.current) {
        visibleRef.current = true;
        setVisibleState(true);
      }
      showTimer.current = null;
    }, SHOW_AFTER_IDLE_MS);
  }, [clearTimer]);

  const hideNow = useCallback(() => {
    if (!visibleRef.current) return;
    visibleRef.current = false;
    setVisibleState(false);
  }, []);

  const onScrollBeginDrag = useCallback(() => {
    interacting.current = true;
    clearTimer();
    hideNow();
  }, [clearTimer, hideNow]);

  const onMomentumScrollBegin = useCallback(() => {
    interacting.current = true;
    clearTimer();
    hideNow();
  }, [clearTimer, hideNow]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      // إخفاء فقط — بدون جدولة إظهار أثناء الحركة (مصدر التردد السابق)
      if (Math.abs(y - lastY.current) > 8) {
        hideNow();
      }
      lastY.current = y;
    },
    [hideNow]
  );

  const onScrollEndDrag = useCallback(
    (e?: NativeSyntheticEvent<NativeScrollEvent>) => {
      const vy = Math.abs(e?.nativeEvent?.velocity?.y ?? 0);
      // إن استمر الزخم، ننتظر onMomentumScrollEnd
      if (vy > 0.15) {
        return;
      }
      interacting.current = false;
      scheduleShow();
    },
    [scheduleShow]
  );

  const onMomentumScrollEnd = useCallback(() => {
    interacting.current = false;
    scheduleShow();
  }, [scheduleShow]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const visibilityValue = useMemo(
    () => ({
      visible,
      setVisible,
    }),
    [visible, setVisible]
  );

  const scrollValue = useMemo(
    () => ({
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
    }),
    [
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
    ]
  );

  return (
    <FloatingChromeVisibilityContext.Provider value={visibilityValue}>
      <FloatingChromeScrollContext.Provider value={scrollValue}>
        {children}
      </FloatingChromeScrollContext.Provider>
    </FloatingChromeVisibilityContext.Provider>
  );
}

const noopScroll: ScrollHandlersValue = {
  onScroll: (_: NativeSyntheticEvent<NativeScrollEvent>) => undefined,
  onScrollBeginDrag: () => undefined,
  onScrollEndDrag: () => undefined,
  onMomentumScrollBegin: () => undefined,
  onMomentumScrollEnd: () => undefined,
};

export function useFloatingChromeVisible() {
  const ctx = useContext(FloatingChromeVisibilityContext);
  if (!ctx) {
    return {
      visible: true,
      setVisible: (_: boolean) => undefined,
    };
  }
  return ctx;
}

export function useFloatingChromeScroll() {
  const ctx = useContext(FloatingChromeScrollContext);
  return ctx ?? noopScroll;
}

export function useFloatingChrome() {
  const visibility = useFloatingChromeVisible();
  const scroll = useFloatingChromeScroll();
  return { ...visibility, ...scroll };
}

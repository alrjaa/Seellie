import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  forceFloatingHidden,
  forceFloatingVisible,
  noteFloatingScrollBegin,
  noteFloatingScrollOffset,
  noteFloatingScrollSettle,
} from '@/services/floating-scroll-bus';

type VisibilityValue = {
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

type ScrollHandlersValue = {
  onScroll: (
    e: NativeSyntheticEvent<NativeScrollEvent>,
    sourceId?: string
  ) => void;
  onScrollBeginDrag: (sourceId?: string) => void;
  onScrollEndDrag: (
    e?: NativeSyntheticEvent<NativeScrollEvent>,
    sourceId?: string
  ) => void;
  onMomentumScrollBegin: (sourceId?: string) => void;
  onMomentumScrollEnd: (sourceId?: string) => void;
};

const FloatingChromeVisibilityContext =
  createContext<VisibilityValue | null>(null);

const FloatingChromeScrollContext =
  createContext<ScrollHandlersValue | null>(null);

const ROOT_SOURCE = 'floating-chrome-root';

const noopScroll: ScrollHandlersValue = {
  onScroll: () => undefined,
  onScrollBeginDrag: () => undefined,
  onScrollEndDrag: () => undefined,
  onMomentumScrollBegin: () => undefined,
  onMomentumScrollEnd: () => undefined,
};

/**
 * يمرّر أحداث التمرير إلى آلة حالات الظهور/الإخفاء.
 */
export function FloatingChromeProvider({ children }: { children: ReactNode }) {
  const setVisible = useCallback((next: boolean) => {
    if (next) forceFloatingVisible();
    else forceFloatingHidden();
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>, sourceId = ROOT_SOURCE) => {
      noteFloatingScrollOffset(sourceId, e.nativeEvent.contentOffset.y);
    },
    []
  );

  const onScrollBeginDrag = useCallback((sourceId = ROOT_SOURCE) => {
    noteFloatingScrollBegin(sourceId);
  }, []);

  const onScrollEndDrag = useCallback(
    (
      _e?: NativeSyntheticEvent<NativeScrollEvent>,
      sourceId = ROOT_SOURCE
    ) => {
      noteFloatingScrollSettle(sourceId);
    },
    []
  );

  const onMomentumScrollBegin = useCallback((sourceId = ROOT_SOURCE) => {
    noteFloatingScrollBegin(sourceId);
  }, []);

  const onMomentumScrollEnd = useCallback((sourceId = ROOT_SOURCE) => {
    noteFloatingScrollSettle(sourceId);
  }, []);

  const visibilityValue = useMemo(
    () => ({ visible: true, setVisible }),
    [setVisible]
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

export function useFloatingChromeVisible() {
  const ctx = useContext(FloatingChromeVisibilityContext);
  if (!ctx) {
    return {
      visible: true,
      setVisible: (next: boolean) => {
        if (next) forceFloatingVisible();
      },
    };
  }
  return ctx;
}

export function useFloatingChromeScroll() {
  const ctx = useContext(FloatingChromeScrollContext);
  return ctx ?? noopScroll;
}

export function useFloatingChrome() {
  return {
    ...useFloatingChromeVisible(),
    ...useFloatingChromeScroll(),
  };
}

export { forceFloatingVisible };

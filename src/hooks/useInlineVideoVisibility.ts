/**
 * Native inline video visibility — measureInWindow on scroll events (no polling).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, type View } from 'react-native';
import { subscribeScrollLayoutChecks } from '@/services/floating-scroll-bus';
import {
  computeVisibleHeightRatio,
  nextInlineVisibilityAutoplay,
} from '@/services/native-feed-autoplay-policy';

type Options = {
  enabled: boolean;
};

export function useInlineVideoVisibility({ enabled }: Options) {
  const containerRef = useRef<View | null>(null);
  const visibleRef = useRef(false);
  const [inView, setInView] = useState(false);

  const measure = useCallback(() => {
    if (!enabled || Platform.OS === 'web') return;
    const node = containerRef.current;
    if (!node) return;
    const windowHeight = Dimensions.get('window').height;
    node.measureInWindow((_x, y, _width, height) => {
      const ratio = computeVisibleHeightRatio(y, height, windowHeight);
      const next = nextInlineVisibilityAutoplay(visibleRef.current, ratio);
      if (next === visibleRef.current) return;
      visibleRef.current = next;
      setInView(next);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      visibleRef.current = false;
      setInView(false);
      return;
    }
    measure();
    return subscribeScrollLayoutChecks(measure);
  }, [enabled, measure]);

  return { containerRef, inView, remeasure: measure };
}

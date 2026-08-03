import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { contentMaxWidth, formMaxWidth, isTablet } from '@/theme/tokens';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  return useMemo(
    () => ({
      width,
      height,
      landscape,
      tablet: isTablet(width),
      contentWidth: contentMaxWidth(width),
      formWidth: formMaxWidth(width),
      gutter: width >= 768 ? 28 : 16,
      columns: width >= 1024 ? 3 : width >= 768 ? 2 : 1,
    }),
    [width, height, landscape]
  );
}

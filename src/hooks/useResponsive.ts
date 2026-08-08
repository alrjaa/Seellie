import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  contentMaxWidth,
  dashboardMaxWidth,
  feedMaxWidth,
  formMaxWidth,
  isDesktopWeb,
  isTablet,
} from '@/theme/tokens';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const desktop = isDesktopWeb(width);

  return useMemo(
    () => ({
      width,
      height,
      landscape,
      tablet: isTablet(width),
      desktop,
      contentWidth: contentMaxWidth(width),
      dashboardWidth: dashboardMaxWidth(width),
      feedWidth: feedMaxWidth(width),
      formWidth: formMaxWidth(width),
      gutter: desktop ? 32 : width >= 768 ? 28 : 16,
      columns: desktop ? 3 : width >= 1024 ? 3 : width >= 768 ? 2 : 1,
      sidebarWidth: desktop ? 248 : 0,
    }),
    [width, height, landscape, desktop]
  );
}

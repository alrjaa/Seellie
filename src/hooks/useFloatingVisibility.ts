import { useEffect, useState } from 'react';
import {
  forceFloatingVisible,
  subscribeFloatingVisibility,
} from '@/services/floating-scroll-bus';

/** حالة ظهور الواجهة العائمة من الـ bus */
export function useFloatingVisibility(initial = true) {
  const [visible, setVisible] = useState(initial);

  useEffect(() => subscribeFloatingVisibility(setVisible), []);

  return {
    visible,
    show: forceFloatingVisible,
  };
}

import { usePrivateSpaceContext } from '@/providers/PrivateSpaceProvider';

/** واجهة موحّدة لمساحة الخاصة — الحالة عالمية عبر PrivateSpaceProvider. */
export function usePrivateSpace(_userId?: string | undefined) {
  return usePrivateSpaceContext();
}

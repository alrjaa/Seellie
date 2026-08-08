import type { AppColors } from '@/theme/colors';

/** لون حالة قابل للقراءة مع الهوية (أبيض primary = نص، لا يصلح كحالة) */
export function statusToneColor(
  colors: AppColors,
  status: string | undefined
): string {
  switch (status) {
    case 'active':
    case 'accepted':
      return colors.accent;
    case 'pending':
    case 'warned':
      return colors.warning;
    case 'suspended':
    case 'declined':
    case 'rejected':
    case 'banned':
      return colors.danger;
    case 'blocked':
      return colors.textMuted;
    default:
      return colors.textMuted;
  }
}

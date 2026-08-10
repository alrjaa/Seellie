import React, { memo } from 'react';

type Props = {
  compact?: boolean;
};

/**
 * دخول المشرف عبر /admin فقط — لا شريحة ظاهرة للمستخدمين العاديين.
 */
function AdminEntryChipComponent(_props: Props) {
  return null;
}

export const AdminEntryChip = memo(AdminEntryChipComponent);

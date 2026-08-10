import React, { memo } from 'react';

/**
 * دخول المشرف عبر /admin فقط — لا يُعرض للجميع في الواجهة.
 */
function AdminEntryButtonComponent() {
  return null;
}

export const AdminEntryButton = memo(AdminEntryButtonComponent);

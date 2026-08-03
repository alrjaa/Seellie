import React, { memo } from 'react';
import { AccountMenuButton } from '@/components/layout/AccountMenuButton';

type Props = {
  accountHref: string;
  settingsHref?: string;
  compact?: boolean;
};

/** معرّف الحساب فقط (@follower) — بدون أيقونة صورة. */
function AccountHeaderButtonComponent({
  accountHref,
  settingsHref,
  compact,
}: Props) {
  return (
    <AccountMenuButton
      accountHref={accountHref}
      settingsHref={settingsHref}
      variant="handle"
      compact={compact}
    />
  );
}

export const AccountHeaderButton = memo(AccountHeaderButtonComponent);

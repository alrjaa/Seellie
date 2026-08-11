import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { PrivateIncomingAlerts } from '@/components/private/PrivateIncomingAlerts';

type State = { failed: boolean };

/** يمنع أي خطأ في تنبيهات الخاصة من إسقاط التطبيق بالكامل */
class PrivateAlertsBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[PrivateIncomingAlerts]', error?.message, info?.componentStack);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export function SafePrivateIncomingAlerts() {
  return (
    <PrivateAlertsBoundary>
      <PrivateIncomingAlerts />
    </PrivateAlertsBoundary>
  );
}

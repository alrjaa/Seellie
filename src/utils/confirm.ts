import { Alert, Platform } from 'react-native';

type ConfirmInput = {
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

/**
 * تأكيد موحّد — يعمل على الويب (window.confirm) والجوال (Alert.alert).
 * Alert.alert وحده غالباً لا يعمل على React Native Web.
 */
export async function confirmDestructive(
  input: ConfirmInput
): Promise<boolean> {
  const cancelLabel = input.cancelLabel || 'إلغاء';
  const confirmLabel = input.confirmLabel || 'تأكيد';

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    return window.confirm(`${input.title}\n\n${input.message}`);
  }

  return await new Promise<boolean>((resolve) => {
    Alert.alert(input.title, input.message, [
      {
        text: cancelLabel,
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: confirmLabel,
        style: input.destructive === false ? 'default' : 'destructive',
        onPress: () => resolve(true),
      },
    ]);
  });
}

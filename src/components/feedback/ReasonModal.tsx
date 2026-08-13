import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { cairoText } from '@/theme/fonts';
import { flowDirection } from '@/theme/direction';

type Props = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function ReasonModal({
  visible,
  title,
  description,
  confirmLabel,
  requireReason = true,
  reasonLabel,
  destructive,
  onCancel,
  onConfirm,
}: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');
  const resolvedReasonLabel = reasonLabel ?? t('feedback.reasonLabel');

  useEffect(() => {
    if (visible) {
      setReason('');
      setError('');
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              ...flowDirection(isRTL),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, cairoText('extraBold'), { color: theme.colors.text }]}>
            {title}
          </Text>
          {description ? (
            <Text style={[styles.desc, cairoText('regular'), { color: theme.colors.textMuted }]}>
              {description}
            </Text>
          ) : null}

          {requireReason ? (
            <View style={{ gap: 6 }}>
              <Text style={[styles.label, cairoText('semiBold'), { color: theme.colors.textMuted }]}>
                {resolvedReasonLabel} *
              </Text>
              <TextInput
                value={reason}
                onChangeText={(v) => {
                  setReason(v);
                  setError('');
                }}
                placeholder={t('feedback.reasonPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    borderColor: error
                      ? theme.colors.danger
                      : theme.colors.border,
                    backgroundColor: theme.colors.inputBg,
                  },
                ]}
              />
              {error ? (
                <Text style={{ color: theme.colors.danger, fontSize: 12 }}>
                  {error}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View
            style={[
              styles.actions,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <Button
              label={t('common.cancel')}
              variant="outline"
              onPress={onCancel}
              style={{ flex: 1 }}
            />
            <Button
              label={resolvedConfirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={() => {
                const trimmed = reason.trim();
                if (requireReason && trimmed.length < 3) {
                  setError(t('feedback.reasonMinLength'));
                  return;
                }
                onConfirm(trimmed);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 12,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  title: {
    fontSize: 17,
    width: '100%',
  },
  desc: {
    fontSize: 13,
    lineHeight: 20,
    width: '100%',
  },
  label: {
    fontSize: 12,
    width: '100%',
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  actions: { gap: 8, marginTop: 4 },
});

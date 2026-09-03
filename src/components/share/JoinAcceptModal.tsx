import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Button, Card, Input, Muted, Subtitle } from '@/components/ui';

type Details = {
  competitionName?: string;
  teamName?: string;
  position?: string;
};

type Props = {
  visible: boolean;
  details?: Details | null;
  note: string;
  onChangeNote: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** نافذة موافقة الانضمام فقط — ليست شاشة الرسائل العامة. */
export function JoinAcceptModal({
  visible,
  details,
  note,
  onChangeNote,
  onCancel,
  onConfirm,
}: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onCancel}>
          <Pressable
            style={[
              styles.card,
              { backgroundColor: theme.colors.surfaceElevated },
            ]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.inner}
            >
              <Subtitle>{t('shareCards.acceptJoinTitle')}</Subtitle>
              <Card
                style={{
                  gap: 6,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: theme.colors.accent,
                }}
              >
                <Muted>{t('shareCards.acceptJoinNotice')}</Muted>
              </Card>
              {details ? (
                <Card style={{ gap: 4, padding: 10 }}>
                  <Muted>
                    {details.competitionName || '—'} — {details.teamName || '—'}
                  </Muted>
                  {details.position ? <Muted>{details.position}</Muted> : null}
                </Card>
              ) : null}
              <Input
                label={t('shareCards.joinAcceptNote')}
                value={note}
                onChangeText={onChangeNote}
                multiline
                placeholder={t('shareCards.joinAcceptNoteHint')}
              />
              <Muted>{t('shareCards.acceptJoinHint')}</Muted>
              <View style={styles.rowBtns}>
                <Button
                  label={t('common.cancel')}
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={onCancel}
                />
                <Button
                  label={t('shareCards.confirmAcceptSend')}
                  style={{ flex: 1 }}
                  onPress={onConfirm}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 10000,
  },
  card: {
    borderRadius: 14,
    padding: 4,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '88%',
  },
  inner: { gap: 10, padding: 12 },
  rowBtns: { flexDirection: 'row', gap: 8 },
});

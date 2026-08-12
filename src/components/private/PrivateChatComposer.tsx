import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Muted } from '@/components/ui';
import { useResponsive } from '@/hooks/useResponsive';
import { setPrivateChatComposerFocused } from '@/services/private-chat-focus';
import type { PrivateChatMediaKind } from '@/services/private-space';

export type PrivateComposerPendingMedia = {
  uri: string;
  kind: PrivateChatMediaKind;
  label?: string;
};

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  pendingMedia: PrivateComposerPendingMedia | null;
  onClearPending: () => void;
  onAttachPress: () => void;
  onSend: () => void;
  sending: boolean;
  enabled: boolean;
  placeholder: string;
  attachAccessibilityLabel: string;
  sendAccessibilityLabel: string;
  cancelAccessibilityLabel: string;
  pendingPhotoLabel: string;
  pendingVideoLabel: string;
  /** إزاحة أسفل الشاشة بسبب لوحة المفاتيح (ويب فقط، عند التركيز) */
  onKeyboardInsetChange?: (inset: number) => void;
  /** عند تركيز/إلغاء تركيز حقل الكتابة */
  onFocusedChange?: (focused: boolean) => void;
};

const INPUT_FONT = 16;
const BTN = 40;
const BLUR_DELAY_MS = 140;

/**
 * ملحّن رسائل خاصة — مكوّن مستقل نظيف.
 * التركيز يتحكم بإخفاء التبويب؛ قياس اللوحة منفصل ولا يخلط مع focus.
 */
function PrivateChatComposerComponent({
  value,
  onChangeText,
  pendingMedia,
  onClearPending,
  onAttachPress,
  onSend,
  sending,
  enabled,
  placeholder,
  attachAccessibilityLabel,
  sendAccessibilityLabel,
  cancelAccessibilityLabel,
  pendingPhotoLabel,
  pendingVideoLabel,
  onKeyboardInsetChange,
  onFocusedChange,
}: Props) {
  const theme = useAppTheme();
  const { desktop } = useResponsive();
  const inputRef = useRef<TextInput>(null);
  const focusedRef = useRef(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastInsetRef = useRef(0);
  const lockedScrollYRef = useRef(0);
  const [focused, setFocused] = useState(false);

  const publishInset = useCallback(
    (inset: number) => {
      // لا نرفع الحقل أعلى من منتصف الشاشة تقريبًا
      const layoutH =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.innerHeight
          : 0;
      const capped =
        layoutH > 0 ? Math.min(inset, Math.floor(layoutH * 0.5)) : inset;
      const next = Math.max(0, Math.round(capped));
      if (next === lastInsetRef.current) return;
      lastInsetRef.current = next;
      onKeyboardInsetChange?.(next);
    },
    [onKeyboardInsetChange]
  );

  const clearBlurTimer = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }, []);

  const setFocusedState = useCallback(
    (next: boolean) => {
      focusedRef.current = next;
      setFocused(next);
      setPrivateChatComposerFocused(next);
      onFocusedChange?.(next);
      if (!next) publishInset(0);
    },
    [publishInset, onFocusedChange]
  );

  useEffect(() => {
    return () => {
      clearBlurTimer();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      setPrivateChatComposerFocused(false);
      onKeyboardInsetChange?.(0);
    };
  }, [clearBlurTimer, onKeyboardInsetChange]);

  // قياس لوحة المفاتيح على الويب فقط أثناء التركيز — مصدر واحد، rAF واحد
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!focused) {
      publishInset(0);
      return;
    }

    const vv = window.visualViewport;
    lockedScrollYRef.current = window.scrollY || 0;

    const measure = () => {
      if (!focusedRef.current) {
        publishInset(0);
        return;
      }
      const layoutH = window.innerHeight;
      const vvH = vv?.height ?? layoutH;
      const vvTop = vv?.offsetTop ?? 0;
      publishInset(Math.max(0, layoutH - vvH - vvTop));
    };

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        // امنع قفزة Safari التي تسحب الصفحة للأعلى
        const y = lockedScrollYRef.current;
        if (Math.abs((window.scrollY || 0) - y) > 1) {
          window.scrollTo({ top: y, left: 0, behavior: 'auto' });
        }
        measure();
      });
    };

    measure();
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [focused, publishInset]);

  const canSend =
    enabled && !sending && (!!value.trim() || !!pendingMedia);

  const onFocus = useCallback(() => {
    clearBlurTimer();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      lockedScrollYRef.current = window.scrollY || 0;
    }
    setFocusedState(true);
  }, [clearBlurTimer, setFocusedState]);

  const onBlur = useCallback(() => {
    clearBlurTimer();
    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      setFocusedState(false);
    }, BLUR_DELAY_MS);
  }, [clearBlurTimer, setFocusedState]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend();
  }, [canSend, onSend]);

  return (
    <View
      style={[
        styles.dock,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceElevated,
          // سطح المكتب: ارفع حقل الكتابة ≈ 1 سم عن أسفل اللوحة
          marginBottom: desktop ? 38 : 0,
        },
      ]}
    >
      {pendingMedia ? (
        <View
          style={[styles.pending, { borderColor: theme.colors.border }]}
        >
          {pendingMedia.kind === 'photo' ? (
            <Image
              source={{ uri: pendingMedia.uri }}
              style={styles.thumb}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumb}>
              <Video
                source={{ uri: pendingMedia.uri }}
                style={StyleSheet.absoluteFillObject}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                isMuted
                useNativeControls={false}
                {...(Platform.OS === 'web'
                  ? ({ playsInline: true } as object)
                  : null)}
              />
              <View style={styles.videoBadge}>
                <Ionicons name="play" size={14} color="#fff" />
              </View>
            </View>
          )}
          <Muted style={styles.pendingLabel} numberOfLines={1}>
            {pendingMedia.label ||
              (pendingMedia.kind === 'photo'
                ? pendingPhotoLabel
                : pendingVideoLabel)}
          </Muted>
          <Pressable
            onPress={onClearPending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={cancelAccessibilityLabel}
          >
            <Ionicons
              name="close-circle"
              size={22}
              color={theme.colors.danger}
            />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          onPress={onAttachPress}
          disabled={!enabled || sending}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={attachAccessibilityLabel}
          style={[styles.iconBtn, { opacity: enabled ? 1 : 0.35 }]}
        >
          <Ionicons
            name="attach-outline"
            size={22}
            color={theme.colors.accent}
          />
        </Pressable>

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          editable={enabled && !sending}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
          onFocus={onFocus}
          onBlur={onBlur}
          multiline={false}
          // 16px يمنع زوم iOS Safari
          style={[
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        />

        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={sendAccessibilityLabel}
          style={[
            styles.sendBtn,
            {
              backgroundColor: theme.colors.accent,
              opacity: canSend ? 1 : 0.4,
            },
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={theme.colors.textInverse}
          />
        </Pressable>
      </View>
    </View>
  );
}

export const PrivateChatComposer = memo(PrivateChatComposerComponent);

const styles = StyleSheet.create({
  dock: {
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginTop: 4,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 8,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0b1220',
  },
  videoBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pendingLabel: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  iconBtn: {
    width: BTN,
    height: BTN,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 42,
    fontSize: INPUT_FONT,
    lineHeight: Platform.OS === 'ios' ? 20 : undefined,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: BTN,
    height: BTN,
    borderRadius: 12,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

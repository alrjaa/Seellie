import React, { memo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { AppText, Muted, Subtitle } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import type { ShareCard } from '@/data/initial-data';
import { formatArabicDate } from '@/utils';

type Props = {
  card: ShareCard;
  compact?: boolean;
};

/**
 * بطاقة مشاركة مرئية جاهزة للعرض/الإرسال داخل التطبيق.
 * تستخدم ألوان الثيم الحالية دون تغيير التصميم العام.
 */
function ShareCardPreviewComponent({ card, compact }: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const isJoin = card.kind === 'join_request';

  return (
    <View
      style={[
        styles.card,
        compact && styles.compact,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.accent,
        },
      ]}
    >
      <View
        style={[
          styles.ribbon,
          { backgroundColor: theme.colors.accent },
        ]}
      >
        <AppText
          style={{
            color: theme.colors.textInverse,
            fontSize: 11,
            fontWeight: '800',
          }}
        >
          {isJoin
            ? t('shareCards.badgeJoin')
            : t('shareCards.badgeContent')}
        </AppText>
      </View>

      <View
        style={[
          styles.header,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Avatar
          uri={card.senderAvatar}
          name={card.senderName}
          size={40}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Subtitle>{card.senderName}</Subtitle>
          <Muted>
            {card.senderHandle || card.senderRole || ''}
          </Muted>
        </View>
        <Ionicons
          name={isJoin ? 'football-outline' : 'share-social-outline'}
          size={20}
          color={theme.colors.accent}
        />
      </View>

      {isJoin ? (
        <View style={styles.body}>
          <Subtitle>{t('shareCards.joinTitle')}</Subtitle>
          <Muted>
            {t('shareCards.competitionLabel')}: {card.competitionName || '—'}
          </Muted>
          <Muted>
            {t('shareCards.teamLabel')}: {card.teamName || '—'}
          </Muted>
          {card.position ? (
            <Muted>
              {t('shareCards.positionLabel')}: {card.position}
            </Muted>
          ) : null}
          {card.body ? <Muted>{card.body}</Muted> : null}
        </View>
      ) : (
        <View style={styles.body}>
          {card.title ? <Subtitle>{card.title}</Subtitle> : null}
          {card.body ? <Muted>{card.body}</Muted> : null}
          {card.mediaUrl && card.mediaKind === 'photo' ? (
            <Image
              source={{ uri: card.mediaUrl }}
              style={styles.media}
              contentFit="cover"
            />
          ) : null}
          {card.mediaUrl && card.mediaKind === 'video' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.video')}
              onPress={() => {
                void Linking.openURL(card.mediaUrl!).catch(() => undefined);
              }}
              style={[
                styles.videoBox,
                { backgroundColor: theme.colors.inputBg },
              ]}
            >
              <Ionicons
                name="play-circle-outline"
                size={36}
                color={theme.colors.accent}
              />
              <Muted>{t('common.video')}</Muted>
            </Pressable>
          ) : null}
        </View>
      )}

      <Muted style={styles.footer}>
        {formatArabicDate(card.timestamp)} · {card.recipientName}
      </Muted>
    </View>
  );
}

export const ShareCardPreview = memo(ShareCardPreviewComponent);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    gap: 10,
    paddingBottom: 12,
  },
  compact: {
    borderRadius: 12,
  },
  ribbon: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  body: {
    paddingHorizontal: 12,
    gap: 6,
  },
  media: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginTop: 4,
  },
  videoBox: {
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 12,
    fontSize: 11,
  },
});

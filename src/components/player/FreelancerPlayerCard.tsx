import React, { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Avatar, Card, Muted } from '@/components/ui';
import { cairoText } from '@/theme/fonts';

type Props = {
  name: string;
  avatar?: string;
  handle?: string;
  visibleId?: string;
  city?: string;
  bio?: string;
  totalLikes?: number;
  photosCount?: number;
  videosCount?: number;
  /** home = بطاقة أفقية ضيقة · row = صف قائمة */
  variant?: 'home' | 'row';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * بطاقة لاعب حر للمتابع — تسلسل خطوط واضح وهوية مهنية.
 */
function FreelancerPlayerCardComponent({
  name,
  avatar,
  handle,
  visibleId,
  city,
  bio,
  totalLikes,
  photosCount,
  videosCount,
  variant = 'row',
  onPress,
  style,
}: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const isHome = variant === 'home';
  const rowDir = isRTL ? ('row-reverse' as const) : ('row' as const);

  const badge = (
    <View
      style={[
        styles.badge,
        isHome ? styles.badgeCentered : null,
        {
          backgroundColor: theme.colors.accentSoft,
          borderColor: theme.colors.accentMuted,
          flexDirection: rowDir,
          alignSelf: isHome ? 'center' : isRTL ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <Ionicons name="flash" size={11} color={theme.colors.accent} />
      <Text style={[styles.badgeText, { color: theme.colors.accent }]}>
        {t('home.freelancerPlayer')}
      </Text>
    </View>
  );

  const metaParts = [
    handle?.trim(),
    city?.trim(),
    visibleId ? t('player.regIdShort', { id: visibleId }) : null,
  ].filter(Boolean) as string[];

  const body = isHome ? (
    <Card style={[styles.homeCard, style]}>
      <View style={styles.homeAvatarWrap}>
        <Avatar uri={avatar} name={name} size={72} />
      </View>
      {badge}
      <Text
        style={[styles.homeName, { color: theme.colors.text }]}
        numberOfLines={2}
      >
        {name}
      </Text>
      {handle ? (
        <Text
          style={[styles.handle, { color: theme.colors.textMuted }]}
          numberOfLines={1}
        >
          {handle}
        </Text>
      ) : null}
      {typeof totalLikes === 'number' ? (
        <View style={[styles.likesRow, { flexDirection: rowDir }]}>
          <Ionicons name="heart" size={12} color={theme.colors.accent} />
          <Text style={[styles.likesText, { color: theme.colors.accent }]}>
            {totalLikes} {t('common.likes')}
          </Text>
        </View>
      ) : null}
    </Card>
  ) : (
    <Card style={[styles.rowCard, style]} padded={false}>
      <View style={[styles.rowInner, { flexDirection: rowDir }]}>
        <Avatar uri={avatar} name={name} size={56} />
        <View style={styles.rowText}>
          <View style={[styles.titleRow, { flexDirection: rowDir }]}>
            <Text
              style={[styles.rowName, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {badge}
          </View>
          {metaParts.length > 0 ? (
            <Text
              style={[styles.metaLine, { color: theme.colors.textMuted }]}
              numberOfLines={1}
            >
              {metaParts.join('  ·  ')}
            </Text>
          ) : (
            <Muted>{t('home.freelancerPlayer')}</Muted>
          )}
          {bio ? (
            <Text
              style={[styles.bio, { color: theme.colors.textMuted }]}
              numberOfLines={2}
            >
              {bio}
            </Text>
          ) : null}
          {(typeof photosCount === 'number' ||
            typeof videosCount === 'number' ||
            typeof totalLikes === 'number') && (
            <View style={styles.statsRow}>
              {typeof photosCount === 'number' ? (
                <Text style={[styles.stat, { color: theme.colors.textMuted }]}>
                  {photosCount} {t('player.photos')}
                </Text>
              ) : null}
              {typeof videosCount === 'number' ? (
                <Text style={[styles.stat, { color: theme.colors.textMuted }]}>
                  {videosCount} {t('player.videos')}
                </Text>
              ) : null}
              {typeof totalLikes === 'number' ? (
                <Text style={[styles.stat, { color: theme.colors.accent }]}>
                  {totalLikes} {t('common.likes')}
                </Text>
              ) : null}
            </View>
          )}
        </View>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={theme.colors.textMuted}
        />
      </View>
    </Card>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
    >
      {body}
    </Pressable>
  );
}

export const FreelancerPlayerCard = memo(FreelancerPlayerCardComponent);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeCentered: {
    alignSelf: 'center',
  },
  badgeText: {
    ...cairoText('semiBold'),
    fontSize: 10,
    letterSpacing: 0.2,
  },
  homeCard: {
    width: 148,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  homeAvatarWrap: {
    marginBottom: 2,
  },
  homeName: {
    ...cairoText('extraBold'),
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    width: '100%',
  },
  handle: {
    ...cairoText('medium'),
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  likesRow: {
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  likesText: {
    ...cairoText('semiBold'),
    fontSize: 11,
  },
  rowCard: {
    overflow: 'hidden',
  },
  rowInner: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowText: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowName: {
    ...cairoText('extraBold'),
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
  metaLine: {
    ...cairoText('medium'),
    fontSize: 12,
    lineHeight: 18,
  },
  bio: {
    ...cairoText('regular'),
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  stat: {
    ...cairoText('semiBold'),
    fontSize: 11,
    lineHeight: 16,
  },
});

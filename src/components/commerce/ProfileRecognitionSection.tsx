import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Card, Muted, Subtitle } from '@/components/ui';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { fetchUserReceivedCertificates } from '@/services/commerce';
import type { ProfileCertificate } from '@/services/commerce/types';
import { certificateImageSource } from '@/theme/certificates';
import { useCommerce } from '@/providers/CommerceProvider';

type Props = {
  userId: string;
};

export function ProfileRecognitionSection({ userId }: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const commerce = useCommerce();
  const [items, setItems] = useState<ProfileCertificate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!commerce.commerceAvailable) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchUserReceivedCertificates(userId);
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commerce.commerceAvailable, userId]);

  if (!commerce.commerceAvailable || !loaded || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Subtitle>{t('commerce.profileRecognition')}</Subtitle>
      <Muted>{t('commerce.profileRecognitionDesc')}</Muted>
      {items.map((item) => {
        const title = isRTL ? item.name_ar || item.name_en : item.name_en || item.name_ar;
        const imageKey = item.image_key || item.catalog_slug || title || '';
        return (
          <Card key={item.id} style={styles.card}>
            <View style={styles.row}>
              <Image
                source={certificateImageSource(imageKey)}
                style={[
                  styles.thumb,
                  { backgroundColor: theme.colors.surfaceElevated },
                ]}
                contentFit="contain"
              />
              <View style={styles.meta}>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  {title}
                </Text>
                <Muted>
                  {t('commerce.fromSender', {
                    name: item.sender_name || item.sender_handle || '—',
                  })}
                </Muted>
                <Muted>
                  {t('certificates.certNumber')}: {item.certificate_number}
                </Muted>
                <Muted>
                  {new Date(item.issued_at).toLocaleDateString()}
                </Muted>
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  card: { gap: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  meta: { flex: 1, gap: 2 },
  title: { fontWeight: '800', fontSize: 15 },
});

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import {
  StackTopChrome,
  stackTopChromePad,
} from '@/components/layout/StackTopChrome';
import { Button, Card, Muted, Subtitle, Title } from '@/components/ui';
import { cairoText } from '@/theme/fonts';
import { getSeellieStory } from '@/content/seellie-story';

/**
 * قصة هوية Seellie — بالعربية أو الإنجليزية حسب لغة التطبيق.
 */
export default function AboutSeellieScreen() {
  const theme = useAppTheme();
  const { t, language, isRTL } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = stackTopChromePad(insets.top);
  const story = useMemo(
    () => getSeellieStory(language === 'en' ? 'en' : 'ar'),
    [language]
  );
  const textAlign = isRTL ? ('right' as const) : ('left' as const);
  const writingDirection = isRTL ? ('rtl' as const) : ('ltr' as const);

  return (
    <View style={styles.root}>
      <StackTopChrome />
      <Screen
        scroll
        hasTabBar={false}
        contentStyle={{ ...styles.content, paddingTop: topPad }}
      >
        <Text
          style={[
            styles.brand,
            cairoText('extraBold'),
            { color: theme.colors.accent, textAlign, writingDirection },
          ]}
        >
          {story.brand}
        </Text>
        <Title style={{ textAlign, writingDirection }}>{story.tagline}</Title>
        <Muted style={{ textAlign, writingDirection }}>{story.subtitle}</Muted>

        {story.blocks.map((block, index) => (
          <Card key={`story-${index}`} style={styles.card}>
            {block.title ? (
              <Subtitle style={{ textAlign, writingDirection }}>
                {block.title}
              </Subtitle>
            ) : null}
            {block.paragraphs.map((paragraph, pIndex) => (
              <Text
                key={`p-${index}-${pIndex}`}
                style={[
                  styles.paragraph,
                  cairoText('regular'),
                  {
                    color: theme.colors.text,
                    textAlign,
                    writingDirection,
                  },
                ]}
              >
                {paragraph}
              </Text>
            ))}
          </Card>
        ))}

        <Card
          style={[
            styles.closingCard,
            {
              backgroundColor: theme.colors.accentSoft,
              borderColor: theme.colors.accent,
            },
          ]}
        >
          {story.closing.map((line, index) => (
            <Text
              key={`close-${index}`}
              style={[
                index === 0 ? styles.closingBrand : styles.closingLine,
                cairoText(index === 0 ? 'extraBold' : 'semiBold'),
                {
                  color: theme.colors.accent,
                  textAlign: 'center',
                  writingDirection,
                },
              ]}
            >
              {line}
            </Text>
          ))}
        </Card>

        <Button
          label={t('common.back')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 14, paddingBottom: 48 },
  brand: {
    fontSize: 28,
    letterSpacing: 0.4,
  },
  card: { gap: 10 },
  paragraph: {
    fontSize: 15,
    lineHeight: 26,
    fontWeight: '500',
  },
  closingCard: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingVertical: 20,
  },
  closingBrand: {
    fontSize: 22,
  },
  closingLine: {
    fontSize: 16,
    lineHeight: 26,
  },
});

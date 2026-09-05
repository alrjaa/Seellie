import React, { useMemo, type ReactNode } from 'react';
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
import { Button, Card, Muted, Subtitle } from '@/components/ui';
import { cairoText } from '@/theme/fonts';
import { getSeellieStory } from '@/content/seellie-story';

/** أزرق بارز لكلمة «لي» في قصة الهوية */
const LI_BLUE = '#2563EB';

const LI_MARK = /\[\[لي\]\]/g;

function renderMarkedText(
  text: string,
  baseStyle: object[],
  keyPrefix: string
): ReactNode {
  const parts = text.split(LI_MARK);
  if (parts.length === 1) {
    return text;
  }
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) {
      nodes.push(
        <Text key={`${keyPrefix}-t-${i}`} style={baseStyle}>
          {part}
        </Text>
      );
    }
    if (i < parts.length - 1) {
      nodes.push(
        <Text
          key={`${keyPrefix}-li-${i}`}
          style={[...baseStyle, styles.liWord]}
        >
          لي
        </Text>
      );
    }
  });
  return nodes;
}

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
  const baseText = {
    color: theme.colors.text,
    textAlign,
    writingDirection,
  } as const;

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
        <Text
          style={[
            styles.tagline,
            cairoText('extraBold'),
            { color: theme.colors.text, textAlign, writingDirection },
          ]}
        >
          {renderMarkedText(
            story.tagline,
            [
              styles.tagline,
              cairoText('extraBold'),
              { color: theme.colors.text, textAlign, writingDirection },
            ],
            'tag'
          )}
        </Text>
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
                style={[styles.paragraph, cairoText('regular'), baseText]}
              >
                {renderMarkedText(
                  paragraph,
                  [styles.paragraph, cairoText('regular'), baseText],
                  `p-${index}-${pIndex}`
                )}
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
              {renderMarkedText(
                line,
                [
                  index === 0 ? styles.closingBrand : styles.closingLine,
                  cairoText(index === 0 ? 'extraBold' : 'semiBold'),
                  {
                    color: theme.colors.accent,
                    textAlign: 'center' as const,
                    writingDirection,
                  },
                ],
                `close-${index}`
              )}
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
  tagline: {
    fontSize: 22,
    lineHeight: 32,
  },
  card: { gap: 10 },
  paragraph: {
    fontSize: 15,
    lineHeight: 26,
    fontWeight: '500',
  },
  liWord: {
    color: LI_BLUE,
    fontWeight: '800',
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

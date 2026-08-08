import React, { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAppTheme } from '@/providers/ThemeProvider';
import { cairoText } from '@/theme/fonts';
import { initials } from '@/utils';

type Props = {
  uri?: string | null;
  name: string;
  size?: number;
};

function AvatarComponent({ uri, name, size = 48 }: Props) {
  const theme = useAppTheme();
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;

  if (showImage) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
        }}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        accessibilityLabel={name}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.accentSoft,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={[
          styles.initials,
          cairoText('extraBold'),
          {
            fontSize: size * 0.32,
            color: theme.colors.accent,
          },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

export const Avatar = memo(AvatarComponent);

const styles = StyleSheet.create({
  initials: {
    textAlign: 'center',
  },
});

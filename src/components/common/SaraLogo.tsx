import React from 'react';
import { Image, View, ViewStyle, ImageStyle } from 'react-native';
import { useAssistant } from '../../store/AssistantStore';

interface SaraLogoProps {
  size?: number;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
}

const logoLight = require('../../assets/logo/logo_light.png');
const logoDark = require('../../assets/logo/logo_dark.png');

export const SaraLogo: React.FC<SaraLogoProps> = ({
  size = 48,
  style,
  imageStyle,
}) => {
  const { themeMode } = useAssistant();
  const source = themeMode === 'dark' ? logoDark : logoLight;

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Image
        source={source}
        style={[
          {
            width: size,
            height: size,
            resizeMode: 'contain',
          },
          imageStyle,
        ]}
      />
    </View>
  );
};

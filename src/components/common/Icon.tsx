import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export type IconName =
  | 'menu'
  | 'plus'
  | 'mic'
  | 'send'
  | 'arrowUp'
  | 'settings'
  | 'sliders'
  | 'trash'
  | 'edit'
  | 'check'
  | 'close'
  | 'chevronRight'
  | 'chevronDown'
  | 'chevronUp'
  | 'cpu'
  | 'shield'
  | 'terminal'
  | 'message'
  | 'sparkles'
  | 'sun'
  | 'moon'
  | 'moreVertical'
  | 'pin'
  | 'play'
  | 'square'
  | 'stop'
  | 'copy'
  | 'code'
  | 'share'
  | 'camera'
  | 'image'
  | 'search'
  | 'volume'
  | 'video';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = '#FFFFFF',
  style,
}) => {
  const strokeWidth = 2;

  switch (name) {
    case 'menu':
      return (
        <View style={[{ width: size, height: size, justifyContent: 'space-between', paddingVertical: size * 0.2 }, style]}>
          <View style={{ height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
        </View>
      );

    case 'plus':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View style={{ position: 'absolute', width: size * 0.75, height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ position: 'absolute', width: strokeWidth, height: size * 0.75, backgroundColor: color, borderRadius: 1 }} />
        </View>
      );

    case 'arrowUp':
    case 'send':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          {/* Vertical stem */}
          <View style={{ width: strokeWidth, height: size * 0.6, backgroundColor: color, borderRadius: 1, marginTop: size * 0.15 }} />
          {/* Left arrow wing */}
          <View
            style={{
              position: 'absolute',
              top: size * 0.22,
              left: size * 0.24,
              width: size * 0.35,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: 1,
              transform: [{ rotate: '-45deg' }],
            }}
          />
          {/* Right arrow wing */}
          <View
            style={{
              position: 'absolute',
              top: size * 0.22,
              right: size * 0.24,
              width: size * 0.35,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: 1,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      );

    case 'mic':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          {/* Mic capsule */}
          <View
            style={{
              width: size * 0.38,
              height: size * 0.52,
              borderRadius: size * 0.19,
              borderWidth: strokeWidth,
              borderColor: color,
              backgroundColor: 'transparent',
            }}
          />
          {/* Base curve */}
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.18,
              width: size * 0.6,
              height: size * 0.38,
              borderBottomLeftRadius: size * 0.3,
              borderBottomRightRadius: size * 0.3,
              borderWidth: strokeWidth,
              borderTopWidth: 0,
              borderColor: color,
            }}
          />
          {/* Stand stem */}
          <View style={{ position: 'absolute', bottom: size * 0.06, width: strokeWidth, height: size * 0.16, backgroundColor: color }} />
        </View>
      );

    case 'settings':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.65,
              height: size * 0.65,
              borderRadius: size * 0.35,
              borderWidth: strokeWidth,
              borderColor: color,
            }}
          />
          <View style={{ position: 'absolute', width: size * 0.85, height: strokeWidth, backgroundColor: color }} />
          <View style={{ position: 'absolute', width: strokeWidth, height: size * 0.85, backgroundColor: color }} />
        </View>
      );

    case 'sliders':
      return (
        <View style={[{ width: size, height: size, justifyContent: 'space-around', paddingVertical: 2 }, style]}>
          <View style={{ height: strokeWidth, backgroundColor: color, borderRadius: 1, width: '100%' }}>
            <View style={{ position: 'absolute', left: '25%', top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          </View>
          <View style={{ height: strokeWidth, backgroundColor: color, borderRadius: 1, width: '100%' }}>
            <View style={{ position: 'absolute', left: '65%', top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          </View>
        </View>
      );

    case 'check':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.55,
              height: size * 0.3,
              borderLeftWidth: strokeWidth,
              borderBottomWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '-45deg' }, { translateY: -2 }],
            }}
          />
        </View>
      );

    case 'close':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View style={{ position: 'absolute', width: size * 0.7, height: strokeWidth, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
          <View style={{ position: 'absolute', width: size * 0.7, height: strokeWidth, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
        </View>
      );

    case 'trash':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          {/* Lid */}
          <View style={{ width: size * 0.7, height: strokeWidth, backgroundColor: color, marginBottom: 2 }} />
          {/* Bin */}
          <View
            style={{
              width: size * 0.52,
              height: size * 0.55,
              borderWidth: strokeWidth,
              borderTopWidth: 0,
              borderColor: color,
              borderBottomLeftRadius: 2,
              borderBottomRightRadius: 2,
            }}
          />
        </View>
      );

    case 'square':
    case 'stop':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.55,
              height: size * 0.55,
              backgroundColor: color,
              borderRadius: 2,
            }}
          />
        </View>
      );

    case 'edit':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.6,
              height: strokeWidth,
              backgroundColor: color,
              transform: [{ rotate: '45deg' }],
            }}
          />
          <View style={{ position: 'absolute', bottom: 3, left: 3, width: 3, height: 3, backgroundColor: color }} />
        </View>
      );

    case 'chevronRight':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.35,
              height: size * 0.35,
              borderTopWidth: strokeWidth,
              borderRightWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '45deg' }, { translateX: -1 }],
            }}
          />
        </View>
      );

    case 'chevronDown':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.35,
              height: size * 0.35,
              borderBottomWidth: strokeWidth,
              borderRightWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '45deg' }, { translateY: -1 }],
            }}
          />
        </View>
      );

    case 'chevronUp':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.35,
              height: size * 0.35,
              borderTopWidth: strokeWidth,
              borderLeftWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '45deg' }, { translateY: 1 }],
            }}
          />
        </View>
      );

    case 'message':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.75,
              height: size * 0.6,
              borderRadius: 3,
              borderWidth: strokeWidth,
              borderColor: color,
            }}
          />
        </View>
      );

    case 'moreVertical':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'space-around', paddingVertical: 3 }, style]}>
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
        </View>
      );

    case 'shield':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.65,
              height: size * 0.7,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              borderBottomLeftRadius: size * 0.3,
              borderBottomRightRadius: size * 0.3,
            }}
          />
        </View>
      );

    case 'cpu':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.55,
              height: size * 0.55,
              borderWidth: strokeWidth,
              borderColor: color,
              borderRadius: 2,
            }}
          />
          <View style={{ position: 'absolute', width: size * 0.85, height: 1, backgroundColor: color }} />
          <View style={{ position: 'absolute', width: 1, height: size * 0.85, backgroundColor: color }} />
        </View>
      );

    case 'sparkles':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.45,
              height: size * 0.45,
              backgroundColor: color,
              transform: [{ rotate: '45deg' }],
              borderRadius: 2,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.12,
              right: size * 0.12,
              width: size * 0.22,
              height: size * 0.22,
              backgroundColor: color,
              transform: [{ rotate: '45deg' }],
              borderRadius: 1,
            }}
          />
        </View>
      );

    case 'sun':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.45,
              height: size * 0.45,
              borderRadius: size * 0.225,
              borderWidth: strokeWidth,
              borderColor: color,
            }}
          />
          {/* Top/Bottom rays */}
          <View style={{ position: 'absolute', width: strokeWidth, height: size * 0.85, backgroundColor: color, borderRadius: 1 }} />
          {/* Left/Right rays */}
          <View style={{ position: 'absolute', width: size * 0.85, height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
        </View>
      );

    case 'moon':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
          <View
            style={{
              width: size * 0.65,
              height: size * 0.65,
              borderRadius: size * 0.325,
              borderWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '-20deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.1,
              left: size * 0.25,
              width: size * 0.55,
              height: size * 0.55,
              borderRadius: size * 0.275,
              backgroundColor: style && (style as any).backgroundColor ? (style as any).backgroundColor : 'transparent',
            }}
          />
        </View>
      );

    case 'copy':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.1,
              left: size * 0.1,
              width: size * 0.58,
              height: size * 0.58,
              borderRadius: 2,
              borderWidth: strokeWidth * 0.8,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.1,
              right: size * 0.1,
              width: size * 0.58,
              height: size * 0.58,
              borderRadius: 2,
              borderWidth: strokeWidth * 0.8,
              borderColor: color,
            }}
          />
        </View>
      );

    case 'code':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.35,
              height: size * 0.35,
              borderLeftWidth: strokeWidth,
              borderBottomWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
              position: 'absolute',
              left: size * 0.1,
            }}
          />
          <View
            style={{
              width: size * 0.35,
              height: size * 0.35,
              borderRightWidth: strokeWidth,
              borderTopWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
              position: 'absolute',
              right: size * 0.1,
            }}
          />
        </View>
      );

    case 'share':
      return (
        <View style={[{ width: size, height: size }, style]}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.12,
              right: size * 0.12,
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: (size * 0.3) / 2,
              borderWidth: strokeWidth * 0.8,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.12,
              right: size * 0.12,
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: (size * 0.3) / 2,
              borderWidth: strokeWidth * 0.8,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.35,
              left: size * 0.12,
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: (size * 0.3) / 2,
              borderWidth: strokeWidth * 0.8,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: size * 0.34,
              left: size * 0.3,
              width: size * 0.38,
              height: strokeWidth * 0.7,
              backgroundColor: color,
              transform: [{ rotate: '-28deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.34,
              left: size * 0.3,
              width: size * 0.38,
              height: strokeWidth * 0.7,
              backgroundColor: color,
              transform: [{ rotate: '28deg' }],
            }}
          />
        </View>
      );

    case 'camera':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          {/* Top bump */}
          <View
            style={{
              position: 'absolute',
              top: size * 0.14,
              width: size * 0.26,
              height: size * 0.12,
              backgroundColor: color,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
            }}
          />
          {/* Body */}
          <View
            style={{
              marginTop: size * 0.08,
              width: size * 0.8,
              height: size * 0.56,
              borderRadius: 3,
              borderWidth: strokeWidth,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Lens */}
            <View
              style={{
                width: size * 0.28,
                height: size * 0.28,
                borderRadius: size * 0.14,
                borderWidth: strokeWidth * 0.9,
                borderColor: color,
              }}
            />
          </View>
        </View>
      );

    case 'image':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View
            style={{
              width: size * 0.8,
              height: size * 0.64,
              borderRadius: 3,
              borderWidth: strokeWidth,
              borderColor: color,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Sun */}
            <View
              style={{
                position: 'absolute',
                top: size * 0.1,
                right: size * 0.12,
                width: size * 0.14,
                height: size * 0.14,
                borderRadius: size * 0.07,
                backgroundColor: color,
              }}
            />
            {/* Peak 1 */}
            <View
              style={{
                position: 'absolute',
                bottom: -size * 0.1,
                left: size * 0.04,
                width: size * 0.38,
                height: size * 0.38,
                backgroundColor: color,
                transform: [{ rotate: '45deg' }],
              }}
            />
            {/* Peak 2 */}
            <View
              style={{
                position: 'absolute',
                bottom: -size * 0.14,
                right: size * 0.06,
                width: size * 0.44,
                height: size * 0.44,
                backgroundColor: color,
                opacity: 0.8,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        </View>
      );

    case 'search':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          {/* Circular magnifying lens */}
          <View
            style={{
              position: 'absolute',
              top: size * 0.12,
              left: size * 0.12,
              width: size * 0.52,
              height: size * 0.52,
              borderRadius: size * 0.26,
              borderWidth: strokeWidth,
              borderColor: color,
            }}
          />
          {/* Handle */}
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.14,
              right: size * 0.16,
              width: strokeWidth * 1.1,
              height: size * 0.34,
              backgroundColor: color,
              borderRadius: 1,
              transform: [{ rotate: '-45deg' }],
            }}
          />
        </View>
      );

    case 'volume':
      return (
        <View style={[{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: size * 0.08 }, style]}>
          {/* Waveform equalizer bars */}
          <View style={{ width: strokeWidth * 0.9, height: size * 0.35, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: strokeWidth * 0.9, height: size * 0.65, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: strokeWidth * 0.9, height: size * 0.45, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: strokeWidth * 0.9, height: size * 0.75, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: strokeWidth * 0.9, height: size * 0.3, backgroundColor: color, borderRadius: 1 }} />
        </View>
      );

    case 'video':
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          {/* Main camera body */}
          <View
            style={{
              width: size * 0.56,
              height: size * 0.46,
              borderRadius: 3,
              borderWidth: strokeWidth,
              borderColor: color,
              marginRight: size * 0.16,
            }}
          />
          {/* Lens triangle projection */}
          <View
            style={{
              position: 'absolute',
              right: size * 0.12,
              top: size * 0.3,
              width: 0,
              height: 0,
              borderTopWidth: size * 0.2,
              borderBottomWidth: size * 0.2,
              borderRightWidth: size * 0.24,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderRightColor: color,
              transform: [{ rotate: '180deg' }],
            }}
          />
        </View>
      );

    default:
      return (
        <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, backgroundColor: color }} />
        </View>
      );
  }
};

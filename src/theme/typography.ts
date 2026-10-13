import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  h1: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  captionMedium: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  small: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
  },
  code: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
};

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceElevated: string;
  surfaceHover: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  accent: string;
  accentSubtle: string;
  success: string;
  warning: string;
  error: string;
  offline: string;
  composerBg: string;
  composerBorder: string;
  sidebarBg: string;
  sidebarHeaderBorder: string;
  userMessageBg: string;
  assistantMessageBg: string;
  toolPillBg: string;
  toolPillBorder: string;
}

export const darkColors: ThemeColors = {
  background: '#171717',
  surface: '#212121',
  surfaceSubtle: '#262626',
  surfaceElevated: '#2F2F2F',
  surfaceHover: '#383838',
  border: '#333333',
  borderSubtle: '#2A2A2A',
  textPrimary: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textInverse: '#171717',
  accent: '#FFFFFF',
  accentSubtle: 'rgba(255, 255, 255, 0.1)',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  offline: '#22C55E',
  composerBg: '#212121',
  composerBorder: '#383838',
  sidebarBg: '#171717',
  sidebarHeaderBorder: '#2A2A2A',
  userMessageBg: '#262626',
  assistantMessageBg: 'transparent',
  toolPillBg: '#262626',
  toolPillBorder: '#383838',
};

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceSubtle: '#F3F4F6',
  surfaceElevated: '#E5E7EB',
  surfaceHover: '#E5E7EB',
  border: '#E5E7EB',
  borderSubtle: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',
  accent: '#111827',
  accentSubtle: 'rgba(17, 24, 39, 0.08)',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  offline: '#16A34A',
  composerBg: '#F9FAFB',
  composerBorder: '#E5E7EB',
  sidebarBg: '#F9FAFB',
  sidebarHeaderBorder: '#E5E7EB',
  userMessageBg: '#F3F4F6',
  assistantMessageBg: 'transparent',
  toolPillBg: '#F3F4F6',
  toolPillBorder: '#E5E7EB',
};

// Default export uses dark mode
export const colors = darkColors;
